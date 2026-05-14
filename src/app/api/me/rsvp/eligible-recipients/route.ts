import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";

const schema = z.object({ sessionId: z.string().uuid() });

export async function GET(req: NextRequest) {
  const session = await requireSession();

  const parsed = schema.safeParse({
    sessionId: req.nextUrl.searchParams.get("sessionId"),
  });
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { sessionId } = parsed.data;
  const sb = createServerSupabase();

  const { data: sess } = await sb
    .from("sessions")
    .select("season_id, status, date")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sess.status !== "scheduled")
    return NextResponse.json({ error: "Session not open" }, { status: 400 });

  // Collect player IDs to exclude: passer, active subscribers, already-in players
  const [{ data: subs }, { data: inRecords }] = await Promise.all([
    sb
      .from("subscriptions")
      .select("player_id")
      .eq("season_id", sess.season_id)
      .in("status", ["confirmed", "paid"]),
    sb
      .from("attendance")
      .select("player_id")
      .eq("session_id", sessionId)
      .eq("rsvp_status", "in"),
  ]);

  const excludeIds = [
    ...new Set([
      session.sub,
      ...(subs ?? []).map((s) => s.player_id),
      ...(inRecords ?? []).map((r) => r.player_id),
    ]),
  ];

  let query = sb
    .from("players")
    .select("id, username, display_name")
    .eq("status", "active");

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: players } = await query.order("display_name").order("username");

  return NextResponse.json({ players: players ?? [] });
}
