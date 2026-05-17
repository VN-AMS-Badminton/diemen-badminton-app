import { createServerSupabase } from "@/lib/supabase/server";

export interface WaitlistPosition {
  position: number; // 1-based; 0 means not on waitlist
  total: number;
}

// Look up FIFO waitlist position for a given player on a session. Used by
// dashboard + admin views to render "You're #2 of 4 on waitlist".
export async function getWaitlistPosition(
  sessionId: string,
  playerId: string,
): Promise<WaitlistPosition> {
  const sb = createServerSupabase();

  const [meRes, totalRes] = await Promise.all([
    sb
      .from("attendance")
      .select("id, created_at, rsvp_status")
      .eq("session_id", sessionId)
      .eq("player_id", playerId)
      .maybeSingle(),
    sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("rsvp_status", "waitlisted"),
  ]);

  const total = totalRes.count ?? 0;
  if (!meRes.data || meRes.data.rsvp_status !== "waitlisted") {
    return { position: 0, total };
  }

  const { count } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("rsvp_status", "waitlisted")
    .lte("created_at", meRes.data.created_at);

  return { position: count ?? 1, total };
}
