import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

const PatchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  weekday_time: z.string().min(1).max(40).optional(),
  location: z.string().max(200).nullable().optional(),
  capacity: z.number().int().min(1).max(200).optional(),
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

  // Date collision check (when changing to a new date).
  if (parsed.data.date && parsed.data.date !== existing.date) {
    const { data: clash } = await sb
      .from("sessions")
      .select("id")
      .eq("season_id", existing.season_id)
      .eq("date", parsed.data.date)
      .neq("id", id)
      .maybeSingle();
    if (clash) {
      return NextResponse.json(
        { error: "Another session already exists on that date" },
        { status: 409 },
      );
    }
  }

  // Build patch payload — null-normalise empty strings on optional fields.
  const patch: Record<string, unknown> = {};
  if (parsed.data.date !== undefined) patch.date = parsed.data.date;
  if (parsed.data.weekday_time !== undefined) patch.weekday_time = parsed.data.weekday_time;
  if (parsed.data.location !== undefined) {
    patch.location = parsed.data.location === "" ? null : parsed.data.location;
  }
  if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity;
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
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 },
    );
  }

  await writeAudit(session.sub, "update_session", "session", id, existing, updated);
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

  // Count attendance rows for response payload (informative for UI).
  const { count: attendanceCount } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", id);

  const { error } = await sb.from("sessions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(session.sub, "delete_session", "session", id, existing, null);
  return NextResponse.json({ ok: true, attendanceDeleted: attendanceCount ?? 0 });
}
