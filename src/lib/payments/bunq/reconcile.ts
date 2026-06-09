// Apply a parsed bunq payment to attendance state, in the trust-first model.
//
// Scope is limited to the NEAREST upcoming scheduled session: that is where
// `unpaid` drop-ins (the rows automation actually helps) live. A payment we
// can't confidently place is recorded in the audit log for the admin queue —
// we never guess. Subscription-sized payments are logged but NOT auto-applied
// (one lump sum maps to many attendance rows; admin handles distribution).
//
// Idempotent: a payment id already stored on any attendance row is a no-op.

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/admin/audit";
import { matchPayment, type MatchablePlayer } from "./match-payment";
import type { ParsedPayment } from "./parse-callback";

export type ReconcileOutcome =
  | "confirmed" // unpaid → assumed_paid
  | "unflagged" // flagged → assumed_paid
  | "proof_recorded" // already assumed_paid, id attached
  | "duplicate" // payment id already processed
  | "no_session" // no upcoming session to match against
  | "subscription_manual" // subscription-sized, left for admin
  | "unclear"; // no/ambiguous match, left for admin

export interface ReconcileResult {
  outcome: ReconcileOutcome;
  attendanceId?: string;
  playerId?: string;
}

interface AttendanceWithPlayer {
  id: string;
  player_id: string;
  source: string;
  payment_status: string;
  bunq_payment_id: string | null;
  players: MatchablePlayer | null;
}

export async function reconcileBunqPayment(
  sb: SupabaseClient,
  payment: ParsedPayment,
): Promise<ReconcileResult> {
  // Ignore non-incoming (outgoing / refund) and non-EUR for now.
  if (payment.amountCents <= 0 || payment.currency !== "EUR") {
    await audit(sb, payment, "bunq_ignored", { reason: "non_incoming_or_currency" });
    return { outcome: "unclear" };
  }

  // Idempotency: same payment id already recorded anywhere → no-op.
  const { data: existing } = await sb
    .from("attendance")
    .select("id")
    .eq("bunq_payment_id", payment.paymentId)
    .limit(1)
    .maybeSingle();
  if (existing) return { outcome: "duplicate", attendanceId: existing.id };

  // Nearest upcoming scheduled session + its season fees.
  const { data: session } = await sb
    .from("sessions")
    .select("id, season_id, seasons:season_id(drop_in_fee_per_session_cents, subscription_fee_per_session_cents)")
    .gte("start_at", new Date().toISOString())
    .eq("status", "scheduled")
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!session) {
    await audit(sb, payment, "bunq_no_session", {});
    return { outcome: "no_session" };
  }

  // PostgREST types the embedded relation as an array; normalize to one row.
  const seasonRel = (session as unknown as {
    seasons:
      | { drop_in_fee_per_session_cents: number; subscription_fee_per_session_cents: number }
      | { drop_in_fee_per_session_cents: number; subscription_fee_per_session_cents: number }[]
      | null;
  }).seasons;
  const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;
  const dropInFeeCents = season?.drop_in_fee_per_session_cents ?? 0;

  // Subscription total = per-session fee × scheduled sessions in the season.
  const { count: sessionCount } = await sb
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("season_id", session.season_id)
    .eq("status", "scheduled");
  const subscriptionTotalCents =
    (season?.subscription_fee_per_session_cents ?? 0) * (sessionCount ?? 1);

  // Attendees of this session.
  const { data: rows } = await sb
    .from("attendance")
    .select("id, player_id, source, payment_status, bunq_payment_id, players:player_id(id, username, display_name)")
    .eq("session_id", session.id)
    .eq("rsvp_status", "in");
  const attendees = (rows ?? []) as unknown as AttendanceWithPlayer[];
  const players = attendees
    .map((r) => r.players)
    .filter((p): p is MatchablePlayer => !!p);

  const match = matchPayment({
    description: payment.description,
    amountCents: payment.amountCents,
    players,
    dropInFeeCents,
    subscriptionTotalCents,
  });

  if (match.scope === "subscription") {
    await audit(sb, payment, "bunq_subscription_payment", {
      player: match.player?.id ?? null,
    });
    return { outcome: "subscription_manual", playerId: match.player?.id };
  }

  if (match.confidence !== "high" || match.scope !== "drop_in") {
    await audit(sb, payment, "bunq_match_unclear", {
      confidence: match.confidence,
      scope: match.scope,
    });
    return { outcome: "unclear" };
  }

  // High-confidence drop-in match: locate the player's drop-in attendance row.
  const row = attendees.find(
    (r) => r.player_id === match.player!.id && r.source === "drop_in",
  );
  if (!row) {
    await audit(sb, payment, "bunq_match_unclear", { reason: "no_drop_in_row" });
    return { outcome: "unclear" };
  }

  const outcome: ReconcileOutcome =
    row.payment_status === "unpaid"
      ? "confirmed"
      : row.payment_status === "flagged"
        ? "unflagged"
        : "proof_recorded";

  const patch: Record<string, unknown> = { bunq_payment_id: payment.paymentId };
  if (outcome === "confirmed" || outcome === "unflagged")
    patch.payment_status = "assumed_paid";

  const { data: after, error: updateError } = await sb
    .from("attendance")
    .update(patch)
    .eq("id", row.id)
    .select()
    .maybeSingle();

  // Partial unique index on bunq_payment_id (migration 0024) turns a racing
  // duplicate callback into a 23505 violation — treat as already-processed.
  if (updateError) {
    if ((updateError as { code?: string }).code === "23505")
      return { outcome: "duplicate", attendanceId: row.id };
    throw new Error(`reconcile update failed: ${updateError.message}`);
  }

  await writeAudit(
    null,
    outcome === "proof_recorded" ? "bunq_proof" : `bunq_${outcome}`,
    "attendance",
    row.id,
    row,
    after ?? { ...row, ...patch },
    sb,
  );

  return { outcome, attendanceId: row.id, playerId: row.player_id };
}

/** Audit a payment event that produced no attendance mutation. */
async function audit(
  sb: SupabaseClient,
  payment: ParsedPayment,
  action: string,
  extra: Record<string, unknown>,
): Promise<void> {
  await writeAudit(
    null,
    action,
    "bunq_payment",
    payment.paymentId,
    null,
    {
      amountCents: payment.amountCents,
      description: payment.description,
      ...extra,
    },
    sb,
  );
}
