import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";
import { sendPushToPlayers } from "@/lib/notifications/send-push";
import { sessionCancelledPayload } from "@/lib/notifications/push-payload";
import { formatDate, formatTime } from "@/lib/format";

// Close the season's signup poll. After this, players can't subscribe/cancel
// or self-mark anything; admin keeps full reconciliation control. Closing a
// season also cancels every still-`scheduled` child session and pushes a
// cancellation notification to all RSVP'd players for those sessions.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const sb = createServerSupabase();

  const { data: before } = await sb
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before)
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  if (before.status !== "poll")
    return NextResponse.json(
      { error: "Season is already closed" },
      { status: 400 },
    );

  const { data: after, error } = await sb
    .from("seasons")
    .update({ status: "closed" })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  // Collect scheduled children before cancelling so we can push for each.
  const { data: scheduledSessions } = await sb
    .from("sessions")
    .select("id, start_at")
    .eq("season_id", id)
    .eq("status", "scheduled");
  const scheduledIds = (scheduledSessions ?? []).map((s) => s.id);

  let sessionsCancelled = 0;
  if (scheduledIds.length > 0) {
    const { error: cancelErr } = await sb
      .from("sessions")
      .update({ status: "cancelled" })
      .in("id", scheduledIds);
    if (!cancelErr) sessionsCancelled = scheduledIds.length;
  }

  // Best-effort push fan-out (don't block the response).
  if (scheduledIds.length > 0) {
    void notifyCancellations(sb, scheduledSessions ?? []).catch((err) => {
      console.error("[close-season] push notify failed", err);
    });
  }

  await writeAudit(session.sub, "close_season", "season", after.id, before, {
    after,
    sessionsCancelled,
  });
  return NextResponse.json({ ok: true, sessionsCancelled });
}

async function notifyCancellations(
  sb: ReturnType<typeof createServerSupabase>,
  sessions: Array<{ id: string; start_at: string }>,
) {
  const sessionIds = sessions.map((s) => s.id);
  const { data: attRows } = await sb
    .from("attendance")
    .select("session_id, player_id")
    .in("session_id", sessionIds)
    .eq("rsvp_status", "in");
  const playersBySession = new Map<string, Set<string>>();
  for (const a of attRows ?? []) {
    const set = playersBySession.get(a.session_id) ?? new Set<string>();
    set.add(a.player_id);
    playersBySession.set(a.session_id, set);
  }
  for (const s of sessions) {
    const players = Array.from(playersBySession.get(s.id) ?? []);
    if (players.length === 0) continue;
    const label = `${formatDate(s.start_at)} ${formatTime(s.start_at)}`;
    await sendPushToPlayers(players, sessionCancelledPayload(label));
  }
}
