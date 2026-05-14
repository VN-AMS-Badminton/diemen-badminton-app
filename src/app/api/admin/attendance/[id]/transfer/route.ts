import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";

const schema = z.object({
  targetPlayerId: z.string().uuid(),
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Props) {
  const admin = await requireAdmin();
  const { id: attendanceId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { targetPlayerId } = parsed.data;
  const sb = createServerSupabase();

  const { data: att } = await sb
    .from("attendance")
    .select("*")
    .eq("id", attendanceId)
    .maybeSingle();
  if (!att) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

  if (att.player_id === targetPlayerId)
    return NextResponse.json({ error: "Source and target are the same player" }, { status: 400 });

  const { data: sess } = await sb
    .from("sessions")
    .select("*")
    .eq("id", att.session_id)
    .maybeSingle();
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sess.status !== "scheduled")
    return NextResponse.json({ error: "Session is not open" }, { status: 400 });

  const sessionDate = new Date(sess.date + "T23:59:59Z");
  if (sessionDate.getTime() < Date.now())
    return NextResponse.json({ error: "Session is in the past" }, { status: 400 });

  if (att.rsvp_status !== "in")
    return NextResponse.json({ error: "Attendance is not active" }, { status: 400 });

  // Target player must be active.
  const { data: target } = await sb
    .from("players")
    .select("id, status")
    .eq("id", targetPlayerId)
    .maybeSingle();

  if (!target || target.status !== "active")
    return NextResponse.json({ error: "Target player not found or inactive" }, { status: 400 });

  // Target must not already be confirmed in.
  const { data: targetAttendance } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", att.session_id)
    .eq("player_id", targetPlayerId)
    .maybeSingle();

  if (targetAttendance?.rsvp_status === "in")
    return NextResponse.json({ error: "Target player already has an active RSVP" }, { status: 409 });

  // Cancel source attendance.
  const newStatus = att.source === "subscription" ? "opted_out" : "cancelled";
  await sb.from("attendance").update({ rsvp_status: newStatus }).eq("id", att.id);

  // Create or update target attendance.
  if (targetAttendance) {
    await sb
      .from("attendance")
      .update({ rsvp_status: "in", source: "drop_in", payment_status: "owed" })
      .eq("id", targetAttendance.id);
  } else {
    await sb.from("attendance").insert({
      session_id: att.session_id,
      player_id: targetPlayerId,
      source: "drop_in",
      rsvp_status: "in",
      payment_status: "owed",
    });
  }

  // Audit log.
  await sb.from("audit_log").insert({
    actor_id: admin.sub,
    action: "admin_rsvp_transfer",
    entity: "attendance",
    entity_id: attendanceId,
    before_json: { player_id: att.player_id, rsvp_status: "in" },
    after_json: { transferred_to: targetPlayerId },
  });

  return NextResponse.json({ ok: true });
}
