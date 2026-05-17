import { createServerSupabase } from "@/lib/supabase/server";
import { resolveCutoffIfDue } from "@/lib/sessions/resolve-cutoff";
import type {
  SessionRow,
  AttendanceRow,
  SubscriptionRow,
  SeasonRow,
} from "@/lib/db/types";

export interface NextSessionData {
  session: SessionRow;
  season: SeasonRow;
  attendance: AttendanceRow | null;
  subscription: SubscriptionRow | null;
  confirmedInCount: number;
  /** Total scheduled sessions in the season — used to compute subscription fee total. */
  seasonSessionCount: number;
}

// Returns the next scheduled session and the player's relationship to it.
export async function getNextSession(
  playerId: string,
): Promise<NextSessionData | null> {
  const sb = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: session } = await sb
    .from("sessions")
    .select("*")
    .gte("date", today)
    .eq("status", "scheduled")
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  // Lazy cutoff resolver — no-op pre-cutoff or if already resolved.
  await resolveCutoffIfDue(session.id);

  const [seasonRes, attRes, subRes, countRes, seasonSessionCountRes] = await Promise.all([
    sb.from("seasons").select("*").eq("id", session.season_id).maybeSingle(),
    sb
      .from("attendance")
      .select("*")
      .eq("session_id", session.id)
      .eq("player_id", playerId)
      .maybeSingle(),
    sb
      .from("subscriptions")
      .select("*")
      .eq("season_id", session.season_id)
      .eq("player_id", playerId)
      .maybeSingle(),
    sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .eq("rsvp_status", "in")
      .is("bumped_at", null),
    sb
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("season_id", session.season_id)
      .eq("status", "scheduled"),
  ]);

  if (!seasonRes.data) return null;

  return {
    session,
    season: seasonRes.data,
    attendance: attRes.data ?? null,
    subscription: subRes.data ?? null,
    confirmedInCount: countRes.count ?? 0,
    seasonSessionCount: seasonSessionCountRes.count ?? 1,
  };
}
