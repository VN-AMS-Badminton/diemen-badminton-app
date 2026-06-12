// Admin-driven cancellation of a player's whole season subscription.
// A subscription is just the player's source='subscription' attendance rows
// across the season's sessions (no subscriptions table — migration 0017), so
// this bulk-applies the same transition as cancel-booking.ts to every row in
// a *future scheduled* session. Past/done sessions stay untouched: the player
// played those, and their payment history must survive.

// Untyped SupabaseClient intentionally — consistent with pass-slot.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRow } from "@/lib/db/types";
import { writeAudit } from "@/lib/admin/audit";
import { promoteWaitlist } from "@/lib/waitlist/promote-waitlist";

export interface CancelSeasonSubscriptionInput {
  sb: SupabaseClient;
  /** Admin performing the cancellation. */
  actorId: string;
  seasonId: string;
  playerId: string;
  /** Optional cancellation reason, stored in the audit log. */
  reason?: string;
}

export type CancelSeasonSubscriptionResult =
  | { ok: true; cancelledCount: number }
  | { ok: false; error: string; status: 404 | 500 };

export async function cancelSeasonSubscription({
  sb,
  actorId,
  seasonId,
  playerId,
  reason,
}: CancelSeasonSubscriptionInput): Promise<CancelSeasonSubscriptionResult> {
  const { data: season } = await sb
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .maybeSingle();
  if (!season) {
    return { ok: false, error: "Season not found", status: 404 };
  }

  const { data: sessions } = await sb
    .from("sessions")
    .select("id")
    .eq("season_id", seasonId)
    .eq("status", "scheduled")
    .gt("start_at", new Date().toISOString());
  const sessionIds = ((sessions ?? []) as { id: string }[]).map((s) => s.id);
  if (sessionIds.length === 0) {
    return { ok: true, cancelledCount: 0 };
  }

  // opted_out rows hold no seat but still belong to the subscription — cancel
  // them too so the player cannot opt back in afterwards.
  const { data: rowsData } = await sb
    .from("attendance")
    .select("*")
    .eq("player_id", playerId)
    .eq("source", "subscription")
    .in("session_id", sessionIds)
    .in("rsvp_status", ["in", "opted_out"]);
  const rows = (rowsData ?? []) as AttendanceRow[];
  if (rows.length === 0) {
    return { ok: true, cancelledCount: 0 };
  }

  const allIds = rows.map((r) => r.id);
  const { error } = await sb
    .from("attendance")
    .update({ rsvp_status: "cancelled", marked_by: actorId })
    .in("id", allIds);
  if (error) {
    return { ok: false, error: "Could not cancel subscription", status: 500 };
  }

  // Refund marker only for rows the player had (assumed) paid; the refund
  // itself settles personally outside the app.
  const refundIds = rows
    .filter((r) => r.payment_status === "assumed_paid")
    .map((r) => r.id);
  if (refundIds.length > 0) {
    await sb
      .from("attendance")
      .update({ payment_status: "refund_pending" })
      .in("id", refundIds);
  }

  await writeAudit(
    actorId,
    "admin_cancel_season_subscription",
    "season",
    seasonId,
    null,
    {
      player_id: playerId,
      cancelled_attendance_ids: allIds,
      refund_pending_attendance_ids: refundIds,
      reason: reason ?? null,
    },
    sb,
  );

  // Only sessions where the player actually held a seat can have freed one.
  const freedSessionIds = rows
    .filter((r) => r.rsvp_status === "in")
    .map((r) => r.session_id);
  for (const sessionId of freedSessionIds) {
    await promoteWaitlist(sessionId);
  }

  return { ok: true, cancelledCount: rows.length };
}
