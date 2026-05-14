import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";

const schema = z.object({
  sessionId: z.string().uuid(),
  targetPlayerId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { sessionId, targetPlayerId } = parsed.data;

  if (targetPlayerId === session.sub)
    return NextResponse.json({ error: "Cannot transfer to yourself" }, { status: 400 });

  const sb = createServerSupabase();

  const { data: sess } = await sb
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sess.status !== "scheduled")
    return NextResponse.json({ error: "Session is not open" }, { status: 400 });

  const sessionDate = new Date(sess.date + "T23:59:59Z");
  if (sessionDate.getTime() < Date.now())
    return NextResponse.json({ error: "Session is in the past" }, { status: 400 });

  // Current player must have an active RSVP.
  const { data: myAttendance } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("player_id", session.sub)
    .maybeSingle();

  if (!myAttendance || myAttendance.rsvp_status !== "in")
    return NextResponse.json({ error: "No active RSVP to transfer" }, { status: 400 });

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
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId)
    .maybeSingle();

  if (targetAttendance?.rsvp_status === "in")
    return NextResponse.json({ error: "Target player already has an active RSVP" }, { status: 409 });

  // Cancel the current player's RSVP.
  const newStatus = myAttendance.source === "subscription" ? "opted_out" : "cancelled";
  await sb.from("attendance").update({ rsvp_status: newStatus }).eq("id", myAttendance.id);

  // Create or update the target player's attendance.
  if (targetAttendance) {
    await sb
      .from("attendance")
      .update({ rsvp_status: "in", source: "drop_in", payment_status: "owed" })
      .eq("id", targetAttendance.id);
  } else {
    await sb.from("attendance").insert({
      session_id: sessionId,
      player_id: targetPlayerId,
      source: "drop_in",
      rsvp_status: "in",
      payment_status: "owed",
    });
  }

  // Audit log.
  await sb.from("audit_log").insert({
    actor_id: session.sub,
    action: "rsvp_transfer",
    entity: "attendance",
    entity_id: myAttendance.id,
    before_json: { player_id: session.sub, rsvp_status: "in" },
    after_json: { transferred_to: targetPlayerId },
  });

  return NextResponse.json({ ok: true });
}
