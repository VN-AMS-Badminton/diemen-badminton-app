import { createServerSupabase } from "@/lib/supabase/server";

export interface UpcomingSessionRow {
  id: string;
  date: string;
  weekdayTime: string;
  // Mandatory per DB schema; type narrowed from nullable for downstream UI.
  location: string;
  capacity: number;
  confirmedCount: number;
  full: boolean;
}

// Returns scheduled sessions still in the future, from today through the end
// of the NEXT calendar month. The wider window covers the end-of-month case
// where a fresh referral link only has next-month options to offer.
export async function listUpcomingSessionsForReferral(): Promise<
  UpcomingSessionRow[]
> {
  const sb = createServerSupabase();

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  // Last day of NEXT month (month+2 with day=0 in JS Date wraps to last of prev).
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    .toISOString()
    .slice(0, 10);

  const { data: sessions } = await sb
    .from("sessions")
    .select("id, date, weekday_time, location, capacity, status")
    .eq("status", "scheduled")
    .gte("date", todayIso)
    .lte("date", windowEnd)
    .order("date", { ascending: true });

  if (!sessions || sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const { data: attendance } = await sb
    .from("attendance")
    .select("session_id")
    .in("session_id", ids)
    .eq("rsvp_status", "in");

  const counts = new Map<string, number>();
  for (const a of attendance ?? []) {
    counts.set(a.session_id, (counts.get(a.session_id) ?? 0) + 1);
  }

  return sessions.map((s) => {
    const confirmedCount = counts.get(s.id) ?? 0;
    return {
      id: s.id,
      date: s.date,
      weekdayTime: s.weekday_time,
      location: s.location,
      capacity: s.capacity,
      confirmedCount,
      full: confirmedCount >= s.capacity,
    };
  });
}
