import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";
import { generateSessionsForSeason } from "@/lib/seasons/generate-sessions-for-season";

// Season-create.
//
// Captures the price commitment (per-session fees + court count), the
// schedule template (weekday + start_time + end_time), the season's date
// range (from_date / to_date), the default location, and an optional Tikkie
// URL override. After the season row is written, this route auto-generates
// one `scheduled` session per matching weekday between from_date and to_date.

const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const TimeString = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

// Default 6 players per court — confirmed club setting.
const PLAYERS_PER_COURT = 6;
// Hard upper bound on auto-gen window so a typo can't flood the table.
const MAX_RANGE_DAYS = 366;

const schema = z
  .object({
    from_date: DateString,
    to_date: DateString,
    poll_opens_at: z.string(),
    poll_closes_at: z.string(),
    court_count: z.number().int().min(1).max(20),
    location: z.string().trim().min(1, "Location is required").max(200),
    weekday: z.number().int().min(0).max(6),
    start_time: TimeString,
    end_time: TimeString,
    subscription_fee_per_session_cents: z.number().int().min(0),
    drop_in_fee_per_session_cents: z.number().int().min(0),
    tikkie_url_override: z
      .string()
      .url()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .strict()
  .refine((v) => v.to_date >= v.from_date, {
    message: "to_date must be on or after from_date",
    path: ["to_date"],
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "end_time must be after start_time",
    path: ["end_time"],
  })
  .refine(
    (v) => {
      const start = Date.parse(v.from_date);
      const end = Date.parse(v.to_date);
      return (end - start) / 86_400_000 <= MAX_RANGE_DAYS;
    },
    { message: `Range must be <= ${MAX_RANGE_DAYS} days`, path: ["to_date"] },
  );

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );

  const input = parsed.data;
  const sb = createServerSupabase();

  // Derive year_month from from_date — kept for display continuity in the
  // existing season list UI.
  const yearMonth = input.from_date.slice(0, 7);

  const { data: created, error } = await sb
    .from("seasons")
    .insert({
      year_month: yearMonth,
      from_date: input.from_date,
      to_date: input.to_date,
      poll_opens_at: input.poll_opens_at,
      poll_closes_at: input.poll_closes_at,
      court_count: input.court_count,
      location: input.location,
      weekday: input.weekday,
      start_time: input.start_time,
      end_time: input.end_time,
      subscription_fee_per_session_cents: input.subscription_fee_per_session_cents,
      drop_in_fee_per_session_cents: input.drop_in_fee_per_session_cents,
      tikkie_url_override: input.tikkie_url_override ?? null,
      status: "poll",
    })
    .select()
    .maybeSingle();

  if (error || !created)
    return NextResponse.json(
      { error: "Create failed: " + (error?.message ?? "") },
      { status: 500 },
    );

  // Auto-generate scheduled sessions. Compensate by deleting the season if
  // generation fails — keeps the DB consistent without explicit transactions.
  let gen;
  try {
    gen = await generateSessionsForSeason(sb, {
      id: created.id,
      from_date: input.from_date,
      to_date: input.to_date,
      weekday: input.weekday,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location,
      capacity: input.court_count * PLAYERS_PER_COURT,
    });
  } catch (genErr) {
    await sb.from("seasons").delete().eq("id", created.id);
    return NextResponse.json(
      {
        error:
          "Season created but session generation failed: " +
          (genErr instanceof Error ? genErr.message : "unknown"),
      },
      { status: 500 },
    );
  }

  if (gen.created === 0) {
    // No matching weekday in range — roll back so admin can fix and retry.
    await sb.from("seasons").delete().eq("id", created.id);
    return NextResponse.json(
      {
        error:
          "Selected weekday does not fall in the chosen date range — no sessions would be generated",
      },
      { status: 400 },
    );
  }

  await writeAudit(session.sub, "create_season", "season", created.id, null, {
    ...created,
    sessionsCreated: gen.created,
    sessionsSkipped: gen.skipped,
  });

  return NextResponse.json({
    ok: true,
    id: created.id,
    sessionsCreated: gen.created,
    sessionsSkipped: gen.skipped,
  });
}
