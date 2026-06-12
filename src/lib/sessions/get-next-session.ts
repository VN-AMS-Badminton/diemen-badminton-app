import { createServerSupabase } from "@/lib/supabase/server";
import { resolveCutoffIfDue } from "@/lib/sessions/resolve-cutoff";
import { resolvePaymentDeadlines } from "@/lib/sessions/resolve-payment-deadlines";
import type {
  SessionRow,
  AttendanceRow,
  SeasonRow,
} from "@/lib/db/types";

export interface NextSessionData {
  session: SessionRow;
  season: SeasonRow;
  attendance: AttendanceRow | null;
  // True when the player is subscribed to the season (i.e. they have at least
  // one subscription attendance row in it). Derived — no subscriptions table.
  isSeasonSubscriber: boolean;
  confirmedInCount: number;
  /** Total scheduled sessions in the season — used to compute subscription fee total. */
  seasonSessionCount: number;
  /** Count of referral attendance rows with rsvp_status=in for this session. */
  trialUsed: number;
}

// Returns the next scheduled session and the player's relationship to it.
export async function getNextSession(
  playerId: string,
): Promise<NextSessionData | null> {
  const sb = createServerSupabase();
  const { data: session } = await sb
    .from("sessions")
    .select("*")
    .gte("start_at", new Date().toISOString())
    .eq("status", "scheduled")
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  // Lazy cutoff resolver — no-op pre-cutoff or if already resolved.
  await resolveCutoffIfDue(session.id);
  // Auto-drop unpaid drop-ins whose 36h window has expired.
  await resolvePaymentDeadlines(session.id);

  const [seasonRes, attRes, countRes, seasonSessionsRes, trialCountRes] = await Promise.all([
    sb.from("seasons").select("*").eq("id", session.season_id).maybeSingle(),
    sb
      .from("attendance")
      .select("*")
      .eq("session_id", session.id)
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
      .select("id")
      .eq("season_id", session.season_id)
      .eq("status", "scheduled"),
    sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .eq("source", "referral")
      .eq("rsvp_status", "in"),
  ]);

  if (!seasonRes.data) return null;

  const seasonSessionIds = (seasonSessionsRes.data ?? []).map((s) => s.id);

  // Subscription state = ANY attendance row with source='subscription' across
  // the season's sessions (defensive: handles edge case where the player has
  // opted out of a single session but is otherwise subscribed).
  let isSeasonSubscriber = false;
  if (seasonSessionIds.length > 0) {
    const { count } = await sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("source", "subscription")
      .in("session_id", seasonSessionIds);
    isSeasonSubscriber = (count ?? 0) > 0;
  }

  return {
    session,
    season: seasonRes.data,
    attendance: attRes.data ?? null,
    isSeasonSubscriber,
    confirmedInCount: countRes.count ?? 0,
    seasonSessionCount: seasonSessionIds.length || 1,
    trialUsed: trialCountRes.count ?? 0,
  };
}
