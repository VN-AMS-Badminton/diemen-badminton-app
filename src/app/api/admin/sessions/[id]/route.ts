import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { sendPushToPlayers } from "@/lib/notifications/send-push";
import {
  sessionCancelledPayload,
  sessionUpdatedPayload,
} from "@/lib/notifications/push-payload";
import {
  toAmsterdamTimestamp,
  localDateFromStartAt,
} from "@/lib/amsterdam-time-utils";
import { formatTime } from "@/lib/format";

const PatchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM")
    .optional(),
  location: z.string().trim().min(1, "Location is required").max(200).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  trial_quota: z.number().int().min(0).max(50).optional(),
  tikkie_url: z.string().url().or(z.literal("")).nullable().optional(),
  status: z.enum(["scheduled", "cancelled", "done"]).optional(),
});

export async function PATCH(
  req: NextRequest,
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

  const sb = createServerSupabase();

  const { data: existing } = await sb
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Status transition guard: prevent rolling back from `done`.
  if (parsed.data.status && existing.status === "done" && parsed.data.status !== "done") {
    return NextResponse.json(
      { error: "Cannot change status of a completed session" },
      { status: 400 },
    );
  }

  // Build patch payload.
  const patch: Record<string, unknown> = {};

  // Recompute start_at when date or time changes.
  if (parsed.data.date !== undefined || parsed.data.time !== undefined) {
    const existingDate = localDateFromStartAt(existing.start_at);
    const existingTime = formatTime(existing.start_at);
    const newDate = parsed.data.date ?? existingDate;
    const newTime = parsed.data.time ?? existingTime;
    patch.start_at = toAmsterdamTimestamp(newDate, newTime);
  }

  if (parsed.data.location !== undefined) patch.location = parsed.data.location;
  if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity;
  if (parsed.data.trial_quota !== undefined) {
    const { count: trialInvited } = await sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", id)
      .eq("source", "referral")
      .eq("rsvp_status", "in");
    if (parsed.data.trial_quota < (trialInvited ?? 0)) {
      return NextResponse.json(
        { error: `Trial slots cannot be set below ${trialInvited} — that many guests are already invited` },
        { status: 400 },
      );
    }
    patch.trial_quota = parsed.data.trial_quota;
  }
  if (parsed.data.tikkie_url !== undefined) {
    patch.tikkie_url = parsed.data.tikkie_url === "" ? null : parsed.data.tikkie_url;
  }
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { data: updated, error } = await sb
    .from("sessions")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !updated) {
    const isConflict = error?.code === "23505";
    if (isConflict) {
      return NextResponse.json(
        { error: "Another session already exists on that date" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 },
    );
  }

  await writeAudit(session.sub, "update_session", "session", id, existing, updated);

  // Notify subscribed attendees on meaningful field changes.
  const relevantChanged =
    patch.start_at !== undefined ||
    patch.location !== undefined ||
    patch.status !== undefined;

  if (relevantChanged) {
    const label = `${formatTime(updated.start_at)} (${localDateFromStartAt(updated.start_at)})`;
    const isCancelled = updated.status === "cancelled" && existing.status !== "cancelled";
    const pushPayload = isCancelled
      ? sessionCancelledPayload(label)
      : sessionUpdatedPayload(label);

    const { data: attendees } = await sb
      .from("attendance")
      .select("player_id")
      .eq("session_id", id);
    const playerIds = (attendees ?? []).map((a) => a.player_id);

    sendPushToPlayers(playerIds, pushPayload).catch((err) =>
      console.error("[push] session update notify failed", err),
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await params;

  const sb = createServerSupabase();
  const { data: existing } = await sb
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Snapshot attendees BEFORE cascade delete so we can notify them.
  const { data: attendees, count: attendanceCount } = await sb
    .from("attendance")
    .select("player_id", { count: "exact" })
    .eq("session_id", id);
  const attendeeIds = (attendees ?? []).map((a) => a.player_id);

  const { error } = await sb.from("sessions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(session.sub, "delete_session", "session", id, existing, null);

  const label = `${formatTime(existing.start_at)} (${localDateFromStartAt(existing.start_at)})`;
  sendPushToPlayers(attendeeIds, sessionCancelledPayload(label)).catch((err) =>
    console.error("[push] session delete notify failed", err),
  );

  return NextResponse.json({ ok: true, attendanceDeleted: attendanceCount ?? 0 });
}
