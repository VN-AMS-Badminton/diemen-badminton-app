import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { computePaymentDeadline } from "@/lib/sessions/payment-deadline";

export interface PromoteResult {
  ok: boolean;
  promotedIds: string[];
}

// Promote oldest waitlisted attendance rows into 'in' until either the queue
// empties or the session reaches capacity. Called when a seat opens via:
//   - member cancels their RSVP
//   - admin manual intervention
//
// Cutoff-driven promotions go through resolve_session_cutoff (RPC) — that path
// also bumps tentative guests, which this helper does NOT do.
export async function promoteWaitlist(sessionId: string): Promise<PromoteResult> {
  const sb = createServerSupabase();

  const { data: sess } = await sb
    .from("sessions")
    .select("id, capacity, start_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess) return { ok: false, promotedIds: [] };

  const { count: inCount } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("rsvp_status", "in")
    .is("bumped_at", null);

  const seats = Math.max(0, sess.capacity - (inCount ?? 0));
  if (seats === 0) return { ok: true, promotedIds: [] };

  const { data: candidates } = await sb
    .from("attendance")
    .select("id, payment_status")
    .eq("session_id", sessionId)
    .eq("rsvp_status", "waitlisted")
    .order("created_at", { ascending: true })
    .limit(seats);

  const ids = (candidates ?? []).map((c) => c.id);
  if (ids.length === 0) return { ok: true, promotedIds: [] };

  // Promoting waitlist rows that are still `unpaid` starts their 36h
  // self-confirm clock. Already-paid rows (admin pre-paid edge cases) keep
  // their deadline cleared.
  const dueAt = computePaymentDeadline(sess.start_at);
  const unpaidIds = (candidates ?? [])
    .filter((c) => c.payment_status === "unpaid")
    .map((c) => c.id);

  const { error } = await sb
    .from("attendance")
    .update({ rsvp_status: "in" })
    .in("id", ids);
  if (error) return { ok: false, promotedIds: [] };

  if (unpaidIds.length > 0) {
    await sb
      .from("attendance")
      .update({ payment_due_at: dueAt })
      .in("id", unpaidIds);
  }

  for (const id of ids) {
    await writeAudit(null, "waitlist_promote", "attendance", id, null, {
      session_id: sessionId,
      reason: "seat_opened",
    });
  }

  return { ok: true, promotedIds: ids };
}
