import type { SupabaseClient } from "@supabase/supabase-js";

// Count occupied seats per session for a set of session ids.
//
// "Occupied" = attendance rows with rsvp_status = 'in' (confirmed seats).
// Deliberately excludes opted_out / cancelled / waitlisted rows, matching the
// capacity semantics used in lib/sessions/capacity.ts and the waitlist logic.
//
// Returns a Map<session_id, occupiedCount>; sessions with zero confirmed
// seats are simply absent from the map (callers default to 0).

export async function countOccupiedBySession(
  sb: SupabaseClient,
  sessionIds: string[],
): Promise<Map<string, number>> {
  const bySession = new Map<string, number>();
  if (sessionIds.length === 0) return bySession;

  const { data } = await sb
    .from("attendance")
    .select("session_id")
    .eq("rsvp_status", "in")
    .in("session_id", sessionIds);

  for (const r of (data ?? []) as { session_id: string }[]) {
    bySession.set(r.session_id, (bySession.get(r.session_id) ?? 0) + 1);
  }
  return bySession;
}
