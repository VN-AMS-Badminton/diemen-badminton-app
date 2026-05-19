import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";

// Trust-first season subscribe.
//
//   POST   /api/me/season/[id]/subscribe — creates one attendance row per
//          scheduled session in the season (source='subscription'). The slot
//          is assumed paid; admin flags exceptions later.
//
//   DELETE /api/me/season/[id]/subscribe — cancels the subscription while the
//          poll is still open. Removes every subscription attendance row the
//          player has in the season.

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await ctx.params;
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  const { data: season } = await sb
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!season)
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  if (season.status !== "poll")
    return NextResponse.json({ error: "Poll is closed" }, { status: 400 });
  if (season.poll_closes_at < nowIso)
    return NextResponse.json({ error: "Poll has ended" }, { status: 400 });

  const { data: sessions } = await sb
    .from("sessions")
    .select("id")
    .eq("season_id", id)
    .eq("status", "scheduled");

  if (!sessions || sessions.length === 0)
    return NextResponse.json(
      { error: "No sessions scheduled yet" },
      { status: 400 },
    );

  // Insert one attendance row per session; ON CONFLICT skips re-subscribes.
  const rows = sessions.map((s) => ({
    session_id: s.id,
    player_id: session.sub,
    source: "subscription" as const,
    rsvp_status: "in" as const,
    payment_status: "assumed_paid" as const,
  }));

  // Supabase JS doesn't expose `ON CONFLICT DO NOTHING` directly; insert with
  // ignoreDuplicates via upsert.
  const { error } = await sb
    .from("attendance")
    .upsert(rows, { onConflict: "session_id,player_id", ignoreDuplicates: true });

  if (error)
    return NextResponse.json({ error: "Subscribe failed" }, { status: 500 });

  return NextResponse.json({ ok: true, sessionsCount: sessions.length });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await ctx.params;
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  const { data: season } = await sb
    .from("seasons")
    .select("status, poll_closes_at")
    .eq("id", id)
    .maybeSingle();
  if (!season)
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  if (season.status !== "poll" || season.poll_closes_at < nowIso)
    return NextResponse.json(
      { error: "Cancellations are no longer allowed" },
      { status: 400 },
    );

  const { data: sessions } = await sb
    .from("sessions")
    .select("id")
    .eq("season_id", id);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return NextResponse.json({ ok: true });

  await sb
    .from("attendance")
    .delete()
    .eq("player_id", session.sub)
    .eq("source", "subscription")
    .in("session_id", sessionIds);

  return NextResponse.json({ ok: true });
}
