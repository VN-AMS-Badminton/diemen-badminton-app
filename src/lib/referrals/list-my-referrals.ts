import { createServerSupabase } from "@/lib/supabase/server";

export type ReferralRowStatus =
  | "tentative"
  | "locked"
  | "attended"
  | "bumped"
  | "cancelled";

export interface MyReferralRow {
  attendanceId: string;
  guestId: string;
  guestName: string;
  sessionId: string;
  sessionDate: string;
  sessionLocation: string;
  status: ReferralRowStatus;
  capConsumed: boolean;
  createdAt: string;
}

// Lists the referrer's guests in reverse-chronological order with a derived
// lifecycle status. Designed for the dashboard ReferLinkCard's history list.
export async function listMyReferrals(
  referrerId: string,
  limit = 10,
): Promise<MyReferralRow[]> {
  const sb = createServerSupabase();

  const { data: guests } = await sb
    .from("players")
    .select("id, display_name")
    .eq("referred_by", referrerId);

  const guestIds = (guests ?? []).map((g) => g.id);
  if (guestIds.length === 0) return [];

  const nameById = new Map(
    (guests ?? []).map((g) => [g.id, g.display_name] as const),
  );

  type Row = {
    id: string;
    player_id: string;
    session_id: string;
    rsvp_status: string;
    is_tentative: boolean;
    bumped_at: string | null;
    cap_consumed: boolean;
    created_at: string;
    sessions: { date: string; location: string } | null;
  };
  const { data } = await sb
    .from("attendance")
    .select(
      "id, player_id, session_id, rsvp_status, is_tentative, bumped_at, cap_consumed, created_at, sessions:session_id(date, location)",
    )
    .eq("source", "referral")
    .in("player_id", guestIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as Row[];
  const todayIso = new Date().toISOString().slice(0, 10);

  return rows.map((r) => ({
    attendanceId: r.id,
    guestId: r.player_id,
    guestName: nameById.get(r.player_id) ?? "(guest)",
    sessionId: r.session_id,
    sessionDate: r.sessions?.date ?? "",
    sessionLocation: r.sessions?.location ?? "",
    status: deriveStatus({
      sessionDate: r.sessions?.date ?? "",
      todayIso,
      bumpedAt: r.bumped_at,
      rsvpStatus: r.rsvp_status,
      isTentative: r.is_tentative,
    }),
    capConsumed: r.cap_consumed,
    createdAt: r.created_at,
  }));
}

function deriveStatus(args: {
  sessionDate: string;
  todayIso: string;
  bumpedAt: string | null;
  rsvpStatus: string;
  isTentative: boolean;
}): ReferralRowStatus {
  if (args.bumpedAt) return "bumped";
  if (args.rsvpStatus === "cancelled") return "cancelled";
  const sessionPassed = !!args.sessionDate && args.sessionDate < args.todayIso;
  if (sessionPassed) return "attended";
  if (args.isTentative) return "tentative";
  return "locked";
}
