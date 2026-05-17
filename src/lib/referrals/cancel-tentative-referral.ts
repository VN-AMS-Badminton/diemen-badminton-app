import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { promoteWaitlist } from "@/lib/waitlist/promote-waitlist";

export interface CancelResult {
  ok: boolean;
  error?: string;
}

// Referrer-driven (or admin) cancel of a tentative referral. Marks the row
// `rsvp_status='cancelled'`. The cap stays consumed (only admin refund-slot
// restores it). Guest's free_trial_used stays false.
//
// Guests have no login of their own, so the actor is always the referrer or
// an admin acting on their behalf.
export async function cancelTentativeReferral(params: {
  attendanceId: string;
  actorId: string;
  isAdmin?: boolean;
}): Promise<CancelResult> {
  const sb = createServerSupabase();

  const { data: row } = await sb
    .from("attendance")
    .select(
      "id, source, rsvp_status, is_tentative, bumped_at, session_id, player_id",
    )
    .eq("id", params.attendanceId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Referral not found" };
  if (row.source !== "referral") {
    return { ok: false, error: "Not a referral attendance row" };
  }
  if (row.bumped_at) return { ok: false, error: "Already bumped" };
  if (row.rsvp_status === "cancelled") {
    return { ok: false, error: "Already cancelled" };
  }
  if (!row.is_tentative) {
    return { ok: false, error: "Already locked in — too late to cancel" };
  }

  // Authorization: actor must be the referrer of this guest, or an admin.
  if (!params.isAdmin) {
    const { data: guest } = await sb
      .from("players")
      .select("referred_by")
      .eq("id", row.player_id)
      .maybeSingle();
    if (!guest || guest.referred_by !== params.actorId) {
      return { ok: false, error: "Not your referral" };
    }
  }

  const { error } = await sb
    .from("attendance")
    .update({ rsvp_status: "cancelled" })
    .eq("id", row.id);
  if (error) return { ok: false, error: "Could not cancel referral" };

  await writeAudit(params.actorId, "cancel_tentative_referral", "attendance", row.id, null, {
    session_id: row.session_id,
    guest_id: row.player_id,
    is_admin: !!params.isAdmin,
  });

  // Freed-up seat → top of waitlist can take it.
  await promoteWaitlist(row.session_id);

  return { ok: true };
}
