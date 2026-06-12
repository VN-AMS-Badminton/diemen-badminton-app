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
  sessionStartAt: string;
  sessionLocation: string;
  status: ReferralRowStatus;
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
    created_at: string;
    sessions: { start_at: string; location: string } | null;
  };
  const { data } = await sb
    .from("attendance")
    .select(
      "id, player_id, session_id, rsvp_status, is_tentative, bumped_at, created_at, sessions:session_id(start_at, location)",
    )
    .eq("source", "referral")
    .in("player_id", guestIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as Row[];

  return rows.map((r) => ({
    attendanceId: r.id,
    guestId: r.player_id,
    guestName: nameById.get(r.player_id) ?? "(guest)",
    sessionId: r.session_id,
    sessionStartAt: r.sessions?.start_at ?? "",
    sessionLocation: r.sessions?.location ?? "",
    status: deriveStatus({
      startAt: r.sessions?.start_at ?? "",
      bumpedAt: r.bumped_at,
      rsvpStatus: r.rsvp_status,
      isTentative: r.is_tentative,
    }),
    createdAt: r.created_at,
  }));
}

function deriveStatus(args: {
  startAt: string;
  bumpedAt: string | null;
  rsvpStatus: string;
  isTentative: boolean;
}): ReferralRowStatus {
  if (args.bumpedAt) return "bumped";
  if (args.rsvpStatus === "cancelled") return "cancelled";
  if (args.startAt && new Date(args.startAt) < new Date()) return "attended";
  if (args.isTentative) return "tentative";
  return "locked";
}
