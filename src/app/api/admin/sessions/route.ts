import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

// Create one session within a season (admin-driven, post-booking).
// Auto-creates attendance rows for every confirmed/paid subscriber so
// the session immediately reflects current subscription roster.

const CreateSchema = z.object({
  season_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  weekday_time: z.string().min(1).max(40),
  location: z.string().trim().min(1, "Location is required").max(200),
  capacity: z.number().int().min(1).max(200),
  tikkie_url: z.string().url().or(z.literal("")).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const sb = createServerSupabase();

  // Verify season exists and is in an editable state.
  const { data: season } = await sb
    .from("seasons")
    .select("id, status")
    .eq("id", parsed.data.season_id)
    .maybeSingle();
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }
  if (season.status !== "booked" && season.status !== "active") {
    return NextResponse.json(
      { error: "Season must be booked or active to add sessions" },
      { status: 400 },
    );
  }

  // Insert session; UNIQUE(season_id, date) catches collisions.
  const insertPayload = {
    season_id: parsed.data.season_id,
    date: parsed.data.date,
    weekday_time: parsed.data.weekday_time,
    location: parsed.data.location,
    capacity: parsed.data.capacity,
    tikkie_url:
      parsed.data.tikkie_url === "" || parsed.data.tikkie_url === undefined
        ? null
        : parsed.data.tikkie_url,
    status: "scheduled" as const,
  };

  const { data: created, error: insertErr } = await sb
    .from("sessions")
    .insert(insertPayload)
    .select()
    .maybeSingle();
  if (insertErr || !created) {
    // Postgres unique violation = 23505.
    const isConflict =
      insertErr?.code === "23505" ||
      insertErr?.message?.toLowerCase().includes("duplicate");
    return NextResponse.json(
      {
        error: isConflict
          ? "A session already exists on that date for this season"
          : (insertErr?.message ?? "Insert failed"),
      },
      { status: isConflict ? 409 : 500 },
    );
  }

  // Auto-create attendance rows for confirmed/paid subscribers (idempotent).
  const { data: subs } = await sb
    .from("subscriptions")
    .select("player_id")
    .eq("season_id", parsed.data.season_id)
    .in("status", ["confirmed", "paid"]);

  let attendanceCreated = 0;
  for (const sub of subs ?? []) {
    const { data: exists } = await sb
      .from("attendance")
      .select("id")
      .eq("session_id", created.id)
      .eq("player_id", sub.player_id)
      .maybeSingle();
    if (!exists) {
      const { error: attErr } = await sb.from("attendance").insert({
        session_id: created.id,
        player_id: sub.player_id,
        source: "subscription",
        rsvp_status: "in",
        payment_status: "n_a",
      });
      if (!attErr) attendanceCreated += 1;
    }
  }

  await writeAudit(session.sub, "create_session", "session", created.id, null, created);
  return NextResponse.json({ ok: true, id: created.id, attendanceCreated });
}
