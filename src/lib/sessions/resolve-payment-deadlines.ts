import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { promoteWaitlist } from "@/lib/waitlist/promote-waitlist";

// Lazy drop-in payment-deadline resolver.
//
// Cancels any unpaid drop-in attendance whose payment_due_at has passed and
// promotes the waitlist to backfill the freed seats. Idempotent — re-running
// after the sweep is a single indexed lookup that finds nothing.
//
// Called from any read/mutate path that touches a session's attendance state:
//   - getNextSession (player dashboard)
//   - RSVP / pass handlers
//   - admin session detail + reconciliation SSR
export async function resolvePaymentDeadlines(sessionId: string): Promise<void> {
  const sb = createServerSupabase();

  // Only resolve while the session is still upcoming. Once it's done/cancelled
  // historical rows must stay intact.
  const { data: sess } = await sb
    .from("sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess || sess.status !== "scheduled") return;

  const nowIso = new Date().toISOString();
  const { data: expired, error } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("rsvp_status", "in")
    .eq("payment_status", "unpaid")
    .lt("payment_due_at", nowIso);
  if (error) {
    console.error("resolvePaymentDeadlines select failed", {
      sessionId,
      error: error.message,
    });
    return;
  }
  if (!expired || expired.length === 0) return;

  for (const row of expired) {
    const { data: after } = await sb
      .from("attendance")
      .update({ rsvp_status: "cancelled" })
      .eq("id", row.id)
      .select()
      .maybeSingle();
    if (after) {
      await writeAudit(
        null,
        "auto_cancel_unpaid_drop_in",
        "attendance",
        row.id,
        row,
        after,
      );
    }
  }

  // Promote the waitlist to fill the freed seats (also sets fresh deadlines
  // on promoted rows that are still unpaid).
  await promoteWaitlist(sessionId);
}
