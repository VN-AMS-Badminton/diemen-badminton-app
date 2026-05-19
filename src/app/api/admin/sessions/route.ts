import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { toAmsterdamTimestamp } from "@/lib/amsterdam-time-utils";

// Create one or more sessions within a season.
//
// Accepts either:
//   * Single date  -> `{ season_id, date, time, location, capacity }`
//   * Batch dates  -> `{ season_id, dates: [...], time, location, capacity }`
//
// `time` is 24h "HH:MM" in Europe/Amsterdam. The API converts date+time to
// a UTC timestamptz stored as `start_at`.

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const TimeString = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const SharedFields = z.object({
  season_id: z.string().uuid(),
  time: TimeString,
  location: z.string().trim().min(1, "Location is required").max(200),
  capacity: z.number().int().min(1).max(200),
  tikkie_url: z.string().url().or(z.literal("")).nullable().optional(),
});

const SingleSchema = SharedFields.extend({ date: DateString });
const BatchSchema = SharedFields.extend({
  dates: z.array(DateString).min(1).max(31),
});

const CreateSchema = z.union([BatchSchema, SingleSchema]);

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

  const dates =
    "dates" in parsed.data ? parsed.data.dates : [parsed.data.date];
  const { season_id, time, location, capacity, tikkie_url } = parsed.data;

  const sb = createServerSupabase();

  const { data: season } = await sb
    .from("seasons")
    .select("id, status")
    .eq("id", season_id)
    .maybeSingle();
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }
  if (season.status !== "poll") {
    return NextResponse.json(
      { error: "Season must be open (poll) to add sessions" },
      { status: 400 },
    );
  }

  const normalizedTikkie =
    tikkie_url === "" || tikkie_url === undefined ? null : tikkie_url;

  // Pull existing subscribers once so each new session can be filled.
  const { data: subRows } = await sb
    .from("attendance")
    .select("player_id, sessions!inner(season_id)")
    .eq("sessions.season_id", season_id)
    .eq("source", "subscription");
  const subscriberIds = Array.from(
    new Set((subRows ?? []).map((r) => r.player_id)),
  );

  let created = 0;
  let skipped = 0;
  const createdIds: string[] = [];

  for (const date of dates) {
    const start_at = toAmsterdamTimestamp(date, time);
    const { data: row, error } = await sb
      .from("sessions")
      .insert({
        season_id,
        start_at,
        location,
        capacity,
        tikkie_url: normalizedTikkie,
        status: "scheduled" as const,
      })
      .select("id")
      .maybeSingle();
    if (error || !row) {
      const isConflict =
        error?.code === "23505" ||
        error?.message?.toLowerCase().includes("duplicate");
      if (isConflict) {
        skipped += 1;
        continue;
      }
      return NextResponse.json(
        { error: error?.message ?? "Insert failed" },
        { status: 500 },
      );
    }
    created += 1;
    createdIds.push(row.id);
  }

  // Fan out subscription attendance for the new sessions.
  if (createdIds.length > 0 && subscriberIds.length > 0) {
    const attendanceRows = createdIds.flatMap((sessionId) =>
      subscriberIds.map((playerId) => ({
        session_id: sessionId,
        player_id: playerId,
        source: "subscription" as const,
        rsvp_status: "in" as const,
        payment_status: "assumed_paid" as const,
      })),
    );
    await sb
      .from("attendance")
      .upsert(attendanceRows, {
        onConflict: "session_id,player_id",
        ignoreDuplicates: true,
      });
  }

  await writeAudit(
    session.sub,
    dates.length > 1 ? "create_sessions_batch" : "create_session",
    "season",
    season_id,
    null,
    { dates, created, skipped, location, time, capacity },
  );

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    sessionIds: createdIds,
  });
}
