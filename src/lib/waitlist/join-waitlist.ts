import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

export interface JoinWaitlistResult {
  ok: boolean;
  error?: string;
  position?: number;
}

// Insert/update a member's attendance row as `waitlisted` when the session is
// full. Returns FIFO position by created_at. Idempotent for the same player:
// re-calling refreshes ordering only if no waitlist row exists.
export async function joinWaitlist(params: {
  sessionId: string;
  playerId: string;
}): Promise<JoinWaitlistResult> {
  const sb = createServerSupabase();

  const { data: existing } = await sb
    .from("attendance")
    .select("id, rsvp_status, source")
    .eq("session_id", params.sessionId)
    .eq("player_id", params.playerId)
    .maybeSingle();

  if (existing) {
    if (existing.rsvp_status === "waitlisted") {
      // Already queued — just return current position.
      return {
        ok: true,
        position: await computePosition(params.sessionId, existing.id),
      };
    }
    if (existing.rsvp_status === "in") {
      return { ok: false, error: "Already RSVP'd in" };
    }
    // cancelled / opted_out → reuse the row.
    // Drop-in stays unpaid through waitlist and promotion; player marks paid
    // before passing the slot.
    const { error } = await sb
      .from("attendance")
      .update({
        rsvp_status: "waitlisted",
        source: "drop_in",
        payment_status: "unpaid",
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: "Could not join waitlist" };
    await writeAudit(params.playerId, "waitlist_join", "attendance", existing.id, null, {
      session_id: params.sessionId,
    });
    return {
      ok: true,
      position: await computePosition(params.sessionId, existing.id),
    };
  }

  const { data: row, error } = await sb
    .from("attendance")
    .insert({
      session_id: params.sessionId,
      player_id: params.playerId,
      source: "drop_in",
      rsvp_status: "waitlisted",
      payment_status: "unpaid",
    })
    .select("id")
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Could not join waitlist" };

  await writeAudit(params.playerId, "waitlist_join", "attendance", row.id, null, {
    session_id: params.sessionId,
  });

  return {
    ok: true,
    position: await computePosition(params.sessionId, row.id),
  };
}

async function computePosition(sessionId: string, attendanceId: string): Promise<number> {
  const sb = createServerSupabase();
  const { data: row } = await sb
    .from("attendance")
    .select("created_at")
    .eq("id", attendanceId)
    .maybeSingle();
  if (!row) return 0;

  const { count } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("rsvp_status", "waitlisted")
    .lte("created_at", row.created_at);
  return count ?? 0;
}
