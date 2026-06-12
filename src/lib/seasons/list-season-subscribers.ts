import type { SupabaseClient } from "@supabase/supabase-js";

// Aggregated subscriber summary for a season. One row per distinct player who
// has at least one `source='subscription'` attendance row in any session of
// the season. Counts paid/flagged/unpaid across the season so the admin
// season view can show "4/5 paid" badges.

export interface SubscriberSummary {
  player_id: string;
  username: string;
  display_name: string | null;
  whatsapp_number: string | null;
  totalSessions: number;
  paidCount: number;
  flaggedCount: number;
  unpaidCount: number;
  // Still-active (in/opted_out) rows in future scheduled sessions — what an
  // admin season-subscription cancel would affect.
  upcomingActiveCount: number;
  firstSubscribedAt: string;
}

interface Row {
  player_id: string;
  session_id: string;
  payment_status: "assumed_paid" | "flagged" | "unpaid" | "refund_pending";
  rsvp_status: string;
  created_at: string;
  players: {
    username: string;
    display_name: string | null;
    whatsapp_number: string | null;
  } | null;
}

export async function listSeasonSubscribers(
  sb: SupabaseClient,
  seasonId: string,
): Promise<SubscriberSummary[]> {
  const { data: sessions } = await sb
    .from("sessions")
    .select("id, status, start_at")
    .eq("season_id", seasonId);
  type SessionInfo = { id: string; status: string; start_at: string };
  const sessionRows = (sessions ?? []) as SessionInfo[];
  const sessionIds = sessionRows.map((s) => s.id);
  if (sessionIds.length === 0) return [];

  const nowIso = new Date().toISOString();
  const upcomingIds = new Set(
    sessionRows
      .filter((s) => s.status === "scheduled" && s.start_at > nowIso)
      .map((s) => s.id),
  );

  const { data } = await sb
    .from("attendance")
    .select(
      "player_id, session_id, payment_status, rsvp_status, created_at, players:player_id(username, display_name, whatsapp_number)",
    )
    .eq("source", "subscription")
    .in("session_id", sessionIds);
  const rows = (data ?? []) as unknown as Row[];

  const byPlayer = new Map<string, SubscriberSummary>();
  for (const r of rows) {
    if (!r.players) continue;
    let entry = byPlayer.get(r.player_id);
    if (!entry) {
      entry = {
        player_id: r.player_id,
        username: r.players.username,
        display_name: r.players.display_name,
        whatsapp_number: r.players.whatsapp_number,
        totalSessions: 0,
        paidCount: 0,
        flaggedCount: 0,
        unpaidCount: 0,
        upcomingActiveCount: 0,
        firstSubscribedAt: r.created_at,
      };
      byPlayer.set(r.player_id, entry);
    }
    entry.totalSessions += 1;
    if (r.created_at < entry.firstSubscribedAt)
      entry.firstSubscribedAt = r.created_at;
    if (r.payment_status === "assumed_paid") entry.paidCount += 1;
    else if (r.payment_status === "flagged") entry.flaggedCount += 1;
    else if (r.payment_status === "unpaid") entry.unpaidCount += 1;
    if (
      upcomingIds.has(r.session_id) &&
      (r.rsvp_status === "in" || r.rsvp_status === "opted_out")
    ) {
      entry.upcomingActiveCount += 1;
    }
  }

  return Array.from(byPlayer.values()).sort((a, b) =>
    a.firstSubscribedAt.localeCompare(b.firstSubscribedAt),
  );
}
