import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";
import { resolvePaymentDeadlines } from "@/lib/sessions/resolve-payment-deadlines";

const schema = z.object({
  sessionId: z.string().uuid(),
  toPlayerId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { sessionId, toPlayerId } = parsed.data;
  if (toPlayerId === session.sub)
    return NextResponse.json({ error: "Cannot pass to yourself" }, { status: 400 });

  const sb = createServerSupabase();

  // Sweep expired unpaid drop-ins so a just-elapsed passer can't slip through.
  await resolvePaymentDeadlines(sessionId);

  const { data: sess } = await sb
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sess.status !== "scheduled")
    return NextResponse.json({ error: "Session is not open" }, { status: 400 });
  if (new Date(sess.start_at).getTime() < Date.now())
    return NextResponse.json({ error: "Session is in the past" }, { status: 400 });

  // Verify passer has an active RSVP
  const { data: passerRow } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("player_id", session.sub)
    .maybeSingle();

  if (!passerRow || passerRow.rsvp_status !== "in")
    return NextResponse.json({ error: "No active RSVP to pass" }, { status: 400 });

  // Drop-in passers must self-confirm payment before handing off the slot.
  // Subscribers paid the season up front, so they bypass this gate.
  if (passerRow.source === "drop_in" && passerRow.payment_status === "unpaid") {
    return NextResponse.json(
      { error: "Mark your payment before passing the slot" },
      { status: 400 },
    );
  }

  // Verify receiver is an active player
  const { data: receiver } = await sb
    .from("players")
    .select("id, status")
    .eq("id", toPlayerId)
    .maybeSingle();
  if (!receiver || receiver.status !== "active")
    return NextResponse.json(
      { error: "Recipient not found or inactive" },
      { status: 400 },
    );

  // Receiver must not already be subscribed to this season. Subscription =
  // any existing attendance row with source='subscription' across the
  // season's sessions.
  const { data: seasonSessions } = await sb
    .from("sessions")
    .select("id")
    .eq("season_id", sess.season_id);
  const seasonSessionIds = (seasonSessions ?? []).map((s) => s.id);
  if (seasonSessionIds.length > 0) {
    const { count: subCount } = await sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("player_id", toPlayerId)
      .eq("source", "subscription")
      .in("session_id", seasonSessionIds);
    if ((subCount ?? 0) > 0)
      return NextResponse.json(
        { error: "Recipient already has a subscription this season" },
        { status: 400 },
      );
  }

  // Receiver must not already be in
  const { data: receiverRow } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("player_id", toPlayerId)
    .maybeSingle();
  if (receiverRow?.rsvp_status === "in")
    return NextResponse.json(
      { error: "Recipient already has an active RSVP" },
      { status: 400 },
    );

  // Set receiver as 'in' first (upsert if existing cancelled row)
  if (receiverRow) {
    const { error } = await sb
      .from("attendance")
      .update({ source: "passed", rsvp_status: "in", payment_status: "assumed_paid" })
      .eq("id", receiverRow.id);
    if (error)
      return NextResponse.json({ error: "Could not pass slot" }, { status: 500 });
  } else {
    const { error } = await sb.from("attendance").insert({
      session_id: sessionId,
      player_id: toPlayerId,
      source: "passed",
      rsvp_status: "in",
      payment_status: "assumed_paid",
    });
    if (error)
      return NextResponse.json({ error: "Could not pass slot" }, { status: 500 });
  }

  // Release passer's slot
  const passerNewStatus =
    passerRow.source === "subscription" ? "opted_out" : "cancelled";
  await sb
    .from("attendance")
    .update({ rsvp_status: passerNewStatus })
    .eq("id", passerRow.id);

  return NextResponse.json({ ok: true });
}
