// Business logic for transferring a session slot from one player to another.
// Extracted from the API route so it can be unit-tested with a mock DB client.
//
// The caller is responsible for:
//  - Running resolvePaymentDeadlines() before calling passSlot() so that
//    an expired-unpaid drop-in cannot slip through the passer-is-paid gate.
//  - Ensuring passerId !== toPlayerId (also checked here for safety).

// Using untyped SupabaseClient intentionally — the hand-written Database type
// doesn't satisfy the full Supabase SDK generic constraints (Views: never),
// consistent with other lib functions in this project (see list-season-subscribers.ts).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PassSlotInput {
  sb: SupabaseClient;
  /** UUID of the player giving up their slot. */
  passerId: string;
  /** UUID of the session whose slot is being transferred. */
  sessionId: string;
  /** UUID of the player receiving the slot. */
  toPlayerId: string;
}

export type PassSlotResult =
  | { ok: true }
  | { ok: false; error: string; status: 400 | 404 | 500 };

export async function passSlot({
  sb,
  passerId,
  sessionId,
  toPlayerId,
}: PassSlotInput): Promise<PassSlotResult> {
  if (passerId === toPlayerId) {
    return { ok: false, error: "Cannot pass to yourself", status: 400 };
  }

  // ── Validate session ──────────────────────────────────────────────────────
  const { data: sess } = await sb
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!sess) return { ok: false, error: "Session not found", status: 404 };
  if (sess.status !== "scheduled")
    return { ok: false, error: "Session is not open", status: 400 };
  if (new Date(sess.start_at).getTime() < Date.now())
    return { ok: false, error: "Session is in the past", status: 400 };

  // ── Validate passer ───────────────────────────────────────────────────────
  const { data: passerRow } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("player_id", passerId)
    .maybeSingle();

  if (!passerRow || passerRow.rsvp_status !== "in")
    return { ok: false, error: "No active RSVP to pass", status: 400 };

  // Drop-in passers must confirm payment before handing off; subscribers paid
  // up front at season subscription time.
  if (passerRow.source === "drop_in" && passerRow.payment_status === "unpaid")
    return {
      ok: false,
      error: "Mark your payment before passing the slot",
      status: 400,
    };

  // ── Validate receiver ─────────────────────────────────────────────────────
  const { data: receiver } = await sb
    .from("players")
    .select("id, status")
    .eq("id", toPlayerId)
    .maybeSingle();

  if (!receiver || receiver.status !== "active")
    return { ok: false, error: "Recipient not found or inactive", status: 400 };

  // A subscriber already has every session in the season locked; they should
  // not receive a passed slot.
  const { data: seasonSessions } = await sb
    .from("sessions")
    .select("id")
    .eq("season_id", sess.season_id);

  const seasonSessionIds = (seasonSessions ?? []).map(
    (s: { id: string }) => s.id,
  );

  if (seasonSessionIds.length > 0) {
    const { count: subCount } = await sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("player_id", toPlayerId)
      .eq("source", "subscription")
      .in("session_id", seasonSessionIds);

    if ((subCount ?? 0) > 0)
      return {
        ok: false,
        error: "Recipient already has a subscription this season",
        status: 400,
      };
  }

  const { data: receiverRow } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("player_id", toPlayerId)
    .maybeSingle();

  if (receiverRow?.rsvp_status === "in")
    return {
      ok: false,
      error: "Recipient already has an active RSVP",
      status: 400,
    };

  // ── Execute transfer ──────────────────────────────────────────────────────
  // Set receiver as 'in'. Reuse an existing non-'in' row (e.g. waitlisted,
  // cancelled) so we don't end up with duplicate rows per player/session.
  if (receiverRow) {
    const { error } = await sb
      .from("attendance")
      .update({ source: "passed", rsvp_status: "in", payment_status: "assumed_paid" })
      .eq("id", receiverRow.id);
    if (error) return { ok: false, error: "Could not pass slot", status: 500 };
  } else {
    const { error } = await sb.from("attendance").insert({
      session_id: sessionId,
      player_id: toPlayerId,
      source: "passed",
      rsvp_status: "in",
      payment_status: "assumed_paid",
    });
    if (error) return { ok: false, error: "Could not pass slot", status: 500 };
  }

  // Passing is a permanent transfer — passer's slot is set to 'passed' which
  // is irreversible and distinct from 'opted_out' (which is reversible) or
  // 'cancelled' (generic drop-in cancel).
  await sb
    .from("attendance")
    .update({ rsvp_status: "passed" })
    .eq("id", passerRow.id);

  // Audit trail.
  await sb.from("audit_log").insert({
    actor_id: passerId,
    action: "pass_slot",
    entity: "attendance",
    entity_id: sessionId,
    before_json: { player_id: passerId, rsvp_status: "in" } as never,
    after_json: { player_id: toPlayerId, rsvp_status: "in" } as never,
  });

  return { ok: true };
}
