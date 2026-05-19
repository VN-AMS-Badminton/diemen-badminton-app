import { createServerSupabase } from "@/lib/supabase/server";

export interface UpcomingSessionRow {
  id: string;
  // Mandatory per DB schema; type narrowed from nullable for downstream UI.
  location: string;
  capacity: number;
  confirmedCount: number;
  full: boolean;
  startAt: string;
  // True when this session is within 24h of starting — UI labels these as
  // "no tentative window; spot is final" and admits them only with seats free.
  subCutoff: boolean;
}

const CUTOFF_MS = 24 * 60 * 60 * 1000;

// Returns scheduled sessions still in the future, up through the end of the
// next calendar month. Sub-24h sessions are included when seats remain so the
// guest page can offer them as "final spot" rows; downstream UI excludes them
// when full.
export async function listUpcomingSessionsForReferral(): Promise<
  UpcomingSessionRow[]
> {
  const sb = createServerSupabase();

  const now = new Date();
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  const { data: sessions } = await sb
    .from("sessions")
    .select("id, location, capacity, status, start_at")
    .eq("status", "scheduled")
    .gte("start_at", now.toISOString())
    .lte("start_at", windowEnd)
    .order("start_at", { ascending: true });

  if (!sessions || sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const { data: attendance } = await sb
    .from("attendance")
    .select("session_id, bumped_at")
    .in("session_id", ids)
    .eq("rsvp_status", "in")
    .is("bumped_at", null);

  const counts = new Map<string, number>();
  for (const a of attendance ?? []) {
    counts.set(a.session_id, (counts.get(a.session_id) ?? 0) + 1);
  }

  const nowMs = now.getTime();
  return sessions.map((s) => {
    const confirmedCount = counts.get(s.id) ?? 0;
    const subCutoff = new Date(s.start_at).getTime() - nowMs < CUTOFF_MS;
    return {
      id: s.id,
      location: s.location,
      capacity: s.capacity,
      confirmedCount,
      full: confirmedCount >= s.capacity,
      startAt: s.start_at,
      subCutoff,
    };
  });
}
