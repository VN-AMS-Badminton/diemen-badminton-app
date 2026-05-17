import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

export interface RefundResult {
  ok: boolean;
  error?: string;
}

// Admin-only: flip an attendance row's cap_consumed flag off, restoring a
// monthly slot to the referrer regardless of bump/cancel/lock-in state.
// Audit-logged so abuse stays traceable.
export async function refundReferrerSlot(params: {
  attendanceId: string;
  adminId: string;
}): Promise<RefundResult> {
  const sb = createServerSupabase();

  const { data: row } = await sb
    .from("attendance")
    .select("id, source, cap_consumed, player_id, session_id")
    .eq("id", params.attendanceId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Attendance not found" };
  if (row.source !== "referral") {
    return { ok: false, error: "Not a referral attendance row" };
  }
  if (!row.cap_consumed) return { ok: true }; // idempotent

  const { error } = await sb
    .from("attendance")
    .update({ cap_consumed: false })
    .eq("id", row.id);
  if (error) return { ok: false, error: "Could not refund slot" };

  await writeAudit(params.adminId, "refund_referrer_slot", "attendance", row.id, null, {
    session_id: row.session_id,
    guest_id: row.player_id,
  });

  return { ok: true };
}
