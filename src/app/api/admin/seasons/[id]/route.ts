import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import {
  planCascade,
  applyCascade,
  type SeasonScheduleSlice,
  type SessionForCascade,
} from "@/lib/seasons/cascade-season-edit";
import { sendPushToPlayers } from "@/lib/notifications/send-push";
import {
  sessionUpdatedPayload,
  sessionCancelledPayload,
} from "@/lib/notifications/push-payload";
import { formatDate, formatTime } from "@/lib/format";

// PATCH /api/admin/seasons/[id]
//
// Edit a season + cascade safe fields to all `scheduled` child sessions.
// If schedule changes leave any session outside the new range or on the wrong
// weekday, the route returns 409 with a `stranded` list. The UI shows a
// confirm dialog; resubmitting with `confirmStranded: true` cancels those
// sessions and applies the rest.

const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const TimeString = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");
const PLAYERS_PER_COURT = 6;

const PatchSchema = z.object({
  from_date: DateString.optional(),
  to_date: DateString.optional(),
  poll_opens_at: z.string().optional(),
  poll_closes_at: z.string().optional(),
  court_count: z.number().int().min(1).max(20).optional(),
  location: z.string().trim().min(1).max(200).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  start_time: TimeString.optional(),
  end_time: TimeString.optional(),
  subscription_fee_per_session_cents: z.number().int().min(0).optional(),
  drop_in_fee_per_session_cents: z.number().int().min(0).optional(),
  tikkie_url_override: z
    .string()
    .url()
    .or(z.literal(""))
    .nullable()
    .optional(),
  // If true, accept the stranded list and auto-cancel those sessions.
  confirmStranded: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const sb = createServerSupabase();
  const { data: existing } = await sb
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing)
    return NextResponse.json({ error: "Season not found" }, { status: 404 });

  if (existing.status === "closed") {
    return NextResponse.json(
      { error: "Cannot edit a closed season" },
      { status: 400 },
    );
  }

  // Build merged next state for validation + cascade planning.
  const next = {
    from_date: input.from_date ?? existing.from_date,
    to_date: input.to_date ?? existing.to_date,
    poll_opens_at: input.poll_opens_at ?? existing.poll_opens_at,
    poll_closes_at: input.poll_closes_at ?? existing.poll_closes_at,
    court_count: input.court_count ?? existing.court_count,
    location: input.location ?? existing.location,
    weekday: input.weekday ?? existing.weekday,
    start_time: input.start_time ?? existing.start_time,
    end_time: input.end_time ?? existing.end_time,
    subscription_fee_per_session_cents:
      input.subscription_fee_per_session_cents ??
      existing.subscription_fee_per_session_cents,
    drop_in_fee_per_session_cents:
      input.drop_in_fee_per_session_cents ??
      existing.drop_in_fee_per_session_cents,
    tikkie_url_override:
      input.tikkie_url_override === undefined
        ? existing.tikkie_url_override
        : input.tikkie_url_override === ""
          ? null
          : input.tikkie_url_override,
  };

  if (next.to_date < next.from_date) {
    return NextResponse.json(
      { error: "to_date must be on or after from_date" },
      { status: 400 },
    );
  }
  if (next.end_time <= next.start_time) {
    return NextResponse.json(
      { error: "end_time must be after start_time" },
      { status: 400 },
    );
  }

  // Plan cascade against current sessions.
  const { data: rawSessions } = await sb
    .from("sessions")
    .select("id, start_at, end_at, status")
    .eq("season_id", id);
  const sessions: SessionForCascade[] = (rawSessions ?? []).map((s) => ({
    id: s.id,
    start_at: s.start_at,
    status: s.status,
  }));

  const slice: SeasonScheduleSlice = {
    weekday: next.weekday,
    start_time: next.start_time,
    end_time: next.end_time,
    from_date: next.from_date,
    to_date: next.to_date,
    location: next.location,
    capacity: next.court_count * PLAYERS_PER_COURT,
    tikkie_url_override: next.tikkie_url_override,
  };
  const plan = planCascade(slice, sessions);

  if (plan.stranded.length > 0 && !input.confirmStranded) {
    return NextResponse.json(
      {
        error: "stranded_sessions",
        stranded: plan.stranded,
        message: `${plan.stranded.length} scheduled session(s) no longer fit the new schedule. Confirm to cancel them.`,
      },
      { status: 409 },
    );
  }

  // Persist season changes first.
  const seasonPatch: Record<string, unknown> = { ...next };
  // year_month always derived from from_date for display continuity.
  seasonPatch.year_month = next.from_date.slice(0, 7);
  delete (seasonPatch as Record<string, unknown>)["confirmStranded"];

  const { data: updated, error: updateErr } = await sb
    .from("seasons")
    .update(seasonPatch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (updateErr || !updated)
    return NextResponse.json(
      { error: "Update failed: " + (updateErr?.message ?? "") },
      { status: 500 },
    );

  // Apply cascade updates.
  let cascadeUpdated = 0;
  try {
    const res = await applyCascade(sb, plan);
    cascadeUpdated = res.updated;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Season updated but session cascade failed: " +
          (err instanceof Error ? err.message : "unknown"),
      },
      { status: 500 },
    );
  }

  // Cancel stranded sessions when admin confirmed.
  let strandedCancelled = 0;
  if (plan.stranded.length > 0 && input.confirmStranded) {
    for (const s of plan.stranded) {
      await sb.from("sessions").update({ status: "cancelled" }).eq("id", s.id);
      strandedCancelled += 1;
    }
  }

  // Notify players via push for changed + cancelled sessions.
  if (cascadeUpdated > 0 || strandedCancelled > 0) {
    void notifyAffectedPlayers(sb, id, plan).catch((err) => {
      console.error("[season-patch] push notify failed", err);
    });
  }

  await writeAudit(session.sub, "edit_season", "season", id, existing, {
    after: updated,
    cascadeUpdated,
    strandedCancelled,
  });

  return NextResponse.json({
    ok: true,
    id,
    cascadeUpdated,
    strandedCancelled,
  });
}

async function notifyAffectedPlayers(
  sb: ReturnType<typeof createServerSupabase>,
  seasonId: string,
  plan: ReturnType<typeof planCascade>,
) {
  const affected = [
    ...plan.toUpdate.map((u) => ({ id: u.id, kind: "updated" as const })),
    ...plan.stranded.map((s) => ({ id: s.id, kind: "cancelled" as const })),
  ];
  if (affected.length === 0) return;

  const sessionIds = affected.map((a) => a.id);
  const { data: sessRows } = await sb
    .from("sessions")
    .select("id, start_at, location")
    .in("id", sessionIds);
  const sessById = new Map<
    string,
    { start_at: string; location: string | null }
  >();
  for (const r of sessRows ?? []) sessById.set(r.id, r);

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

  for (const a of affected) {
    const players = Array.from(playersBySession.get(a.id) ?? []);
    if (players.length === 0) continue;
    const s = sessById.get(a.id);
    if (!s) continue;
    const label = `${formatDate(s.start_at)} ${formatTime(s.start_at)}`;
    const payload =
      a.kind === "cancelled"
        ? sessionCancelledPayload(label)
        : sessionUpdatedPayload(label);
    await sendPushToPlayers(players, payload);
  }
  void seasonId;
}
