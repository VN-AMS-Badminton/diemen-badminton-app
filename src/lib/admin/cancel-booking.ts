// Admin-driven cancellation of a single booking (one attendance row).
// Extracted from the API route so it can be unit-tested with a mock DB
// client, like pass-slot.ts. Season-wide cancellation lives in
// cancel-season-subscription.ts.
//
// Design (docs/suggestion/admin-cancel-booking-plan.md):
//  - Seat accounting is live (rsvp_status='in' AND bumped_at IS NULL), so
//    flipping the row off 'in' frees the seat; we additionally promote the
//    waitlist, same as the player self-cancel paths.
//  - assumed_paid rows move to 'refund_pending' — the refund itself settles
//    personally outside the app; admin clears the marker once settled.
//  - Trial guest rows (source='referral') mirror the referrer revoke instead:
//    the guest player row is deleted (attendance cascades) so the phone's
//    one-trial-per-number budget is freed for a future invite.

// Untyped SupabaseClient intentionally — consistent with pass-slot.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRow, PaymentStatus, SessionRow } from "@/lib/db/types";
import { writeAudit } from "@/lib/admin/audit";
import { promoteWaitlist } from "@/lib/waitlist/promote-waitlist";

export interface CancelBookingInput {
  sb: SupabaseClient;
  /** Admin performing the cancellation. */
  actorId: string;
  attendanceId: string;
  /** Optional cancellation reason, stored in the audit log. */
  reason?: string;
}

export type CancelBookingResult =
  | { ok: true; mode: "cancelled" | "guest_deleted" }
  | { ok: false; error: string; status: 400 | 404 | 500 };

// assumed_paid → refund_pending; unpaid never paid, flagged is already an
// admin dispute, both keep their state.
export function nextPaymentStatusOnCancel(status: PaymentStatus): PaymentStatus {
  return status === "assumed_paid" ? "refund_pending" : status;
}

export async function cancelBooking({
  sb,
  actorId,
  attendanceId,
  reason,
}: CancelBookingInput): Promise<CancelBookingResult> {
  const { data: att } = await sb
    .from("attendance")
    .select("*")
    .eq("id", attendanceId)
    .maybeSingle();
  const before = att as AttendanceRow | null;
  if (!before) {
    return { ok: false, error: "Booking not found", status: 404 };
  }

  const { data: sess } = await sb
    .from("sessions")
    .select("id, status, start_at")
    .eq("id", before.session_id)
    .maybeSingle();
  const session = sess as Pick<SessionRow, "id" | "status" | "start_at"> | null;
  if (!session) {
    return { ok: false, error: "Session not found", status: 404 };
  }
  if (session.status !== "scheduled") {
    return { ok: false, error: "Session is not open", status: 400 };
  }
  if (new Date(session.start_at).getTime() <= Date.now()) {
    return { ok: false, error: "Session has already started", status: 400 };
  }
  if (before.rsvp_status !== "in" && before.rsvp_status !== "waitlisted") {
    return { ok: false, error: "Booking is not active", status: 400 };
  }

  const heldSeat = before.rsvp_status === "in";

  // ── Trial guest: delete the account instead of cancelling the row ────────
  if (before.source === "referral") {
    const { data: guest } = await sb
      .from("players")
      .select("id, username, display_name, referred_by, free_trial_used")
      .eq("id", before.player_id)
      .maybeSingle();

    // Guests always have referred_by set; a bare referral row without it is
    // legacy data — fall through to the regular cancel path below.
    if (guest?.referred_by) {
      const { error } = await sb.from("players").delete().eq("id", guest.id);
      if (error) {
        return { ok: false, error: "Could not cancel booking", status: 500 };
      }
      await writeAudit(
        actorId,
        "admin_cancel_booking",
        "attendance",
        before.id,
        before,
        {
          mode: "guest_deleted",
          guest_id: guest.id,
          guest_name: guest.display_name ?? guest.username,
          session_id: session.id,
          reason: reason ?? null,
        },
        sb,
      );
      if (heldSeat) await promoteWaitlist(session.id);
      return { ok: true, mode: "guest_deleted" };
    }
  }

  // ── Member booking: cancel the row, flag refund if they had paid ─────────
  const { data: after, error } = await sb
    .from("attendance")
    .update({
      rsvp_status: "cancelled",
      payment_status: nextPaymentStatusOnCancel(before.payment_status),
      marked_by: actorId,
    })
    .eq("id", before.id)
    .select()
    .maybeSingle();
  if (error || !after) {
    return { ok: false, error: "Could not cancel booking", status: 500 };
  }

  await writeAudit(
    actorId,
    "admin_cancel_booking",
    "attendance",
    before.id,
    before,
    { ...(after as AttendanceRow), reason: reason ?? null },
    sb,
  );
  if (heldSeat) await promoteWaitlist(session.id);
  return { ok: true, mode: "cancelled" };
}
