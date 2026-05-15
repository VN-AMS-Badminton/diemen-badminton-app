import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";
import { generateSessions } from "@/lib/seasons/generate-sessions";

const schema = z.object({
  court_count: z.number().int().min(1).max(20),
  capacity_override: z.number().int().min(1).max(200).optional(),
  weekday: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  subscription_fee_per_session_cents: z.number().int().min(0).optional(),
  drop_in_fee_per_session_cents: z.number().int().min(0).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );

  const sb = createServerSupabase();

  const { data: season } = await sb
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (season.status !== "poll" && season.status !== "booked")
    return NextResponse.json({ error: "Season cannot be booked from this state" }, { status: 400 });

  const capacity =
    parsed.data.capacity_override ?? parsed.data.court_count * 4;

  // Update season.
  const updates = {
    court_count: parsed.data.court_count,
    status: "booked" as const,
    subscription_fee_per_session_cents:
      parsed.data.subscription_fee_per_session_cents ?? season.subscription_fee_per_session_cents,
    drop_in_fee_per_session_cents:
      parsed.data.drop_in_fee_per_session_cents ?? season.drop_in_fee_per_session_cents,
  };
  const { data: updatedSeason, error: seasonErr } = await sb
    .from("seasons")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (seasonErr || !updatedSeason)
    return NextResponse.json({ error: "Season update failed" }, { status: 500 });

  // Generate sessions for the year_month.
  const planned = generateSessions({
    yearMonth: season.year_month,
    weekday: parsed.data.weekday,
    time: parsed.data.time,
  });

  // Insert-only: preserve manual edits made via per-session admin UI.
  // Existing rows on the same (season_id, date) are skipped untouched.
  let sessionsCreated = 0;
  let sessionsSkipped = 0;
  for (const p of planned) {
    const { data: existing } = await sb
      .from("sessions")
      .select("id")
      .eq("season_id", id)
      .eq("date", p.date)
      .maybeSingle();
    if (existing) {
      sessionsSkipped += 1;
      continue;
    }
    const { error: insertErr } = await sb.from("sessions").insert({
      season_id: id,
      date: p.date,
      weekday_time: p.weekday_time,
      capacity,
      status: "scheduled",
    });
    if (!insertErr) sessionsCreated += 1;
  }

  // Confirm all opted-in subscriptions.
  const { data: subs } = await sb
    .from("subscriptions")
    .select("*")
    .eq("season_id", id)
    .eq("status", "opted_in");
  for (const s of subs ?? []) {
    await sb
      .from("subscriptions")
      .update({ status: "confirmed" })
      .eq("id", s.id);
  }

  // Auto-create attendance rows for confirmed subscribers × all sessions.
  const { data: confirmedSubs } = await sb
    .from("subscriptions")
    .select("player_id")
    .eq("season_id", id)
    .in("status", ["confirmed", "paid"]);

  const { data: sessions } = await sb
    .from("sessions")
    .select("id")
    .eq("season_id", id);

  for (const s of sessions ?? []) {
    for (const sub of confirmedSubs ?? []) {
      const { data: existsAtt } = await sb
        .from("attendance")
        .select("id")
        .eq("session_id", s.id)
        .eq("player_id", sub.player_id)
        .maybeSingle();
      if (!existsAtt) {
        await sb.from("attendance").insert({
          session_id: s.id,
          player_id: sub.player_id,
          source: "subscription",
          rsvp_status: "in",
          payment_status: "n_a",
        });
      }
    }
  }

  await writeAudit(session.sub, "book_season", "season", id, season, updatedSeason);
  return NextResponse.json({
    ok: true,
    // Back-compat alias: total planned by the template (created + skipped).
    sessionsGenerated: planned.length,
    sessionsCreated,
    sessionsSkipped,
    subscribersConfirmed: subs?.length ?? 0,
  });
}
