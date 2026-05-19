import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";
import { joinWaitlist } from "@/lib/waitlist/join-waitlist";
import { promoteWaitlist } from "@/lib/waitlist/promote-waitlist";
import { resolveCutoffIfDue } from "@/lib/sessions/resolve-cutoff";
import { resolvePaymentDeadlines } from "@/lib/sessions/resolve-payment-deadlines";
import { computePaymentDeadline } from "@/lib/sessions/payment-deadline";

const schema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum([
    "opt_out",
    "opt_in",
    "drop_in_rsvp",
    "drop_in_cancel",
    "waitlist_leave",
  ]),
});

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { sessionId, action } = parsed.data;
  const sb = createServerSupabase();

  // Resolve cutoff + auto-drop expired unpaid drop-ins before reads so the
  // capacity check sees the freshly freed seats.
  await resolveCutoffIfDue(sessionId);
  await resolvePaymentDeadlines(sessionId);

  const { data: sess } = await sb
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sess.status !== "scheduled")
    return NextResponse.json({ error: "Session is not open" }, { status: 400 });

  if (new Date(sess.start_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Session is in the past" }, { status: 400 });
  }

  const { data: existing } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId)
    .eq("player_id", session.sub)
    .maybeSingle();

  if (action === "opt_out") {
    if (!existing || existing.source !== "subscription")
      return NextResponse.json({ error: "Not a subscriber slot" }, { status: 400 });
    await sb
      .from("attendance")
      .update({ rsvp_status: "opted_out" })
      .eq("id", existing.id);
    // Free seat → promote oldest waitlisted member.
    await promoteWaitlist(sessionId);
    return NextResponse.json({ ok: true });
  }

  if (action === "opt_in") {
    if (!existing || existing.source !== "subscription")
      return NextResponse.json({ error: "Not a subscriber slot" }, { status: 400 });
    // Capacity check: only re-opt-in if slot still free.
    const { count } = await sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("rsvp_status", "in")
      .is("bumped_at", null);
    if ((count ?? 0) >= sess.capacity) {
      return NextResponse.json({ error: "Session is full" }, { status: 409 });
    }
    await sb
      .from("attendance")
      .update({ rsvp_status: "in" })
      .eq("id", existing.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "drop_in_rsvp") {
    // Capacity check — only non-bumped 'in' rows count.
    const { count } = await sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("rsvp_status", "in")
      .is("bumped_at", null);
    const inCount = count ?? 0;

    if (inCount >= sess.capacity) {
      // Session full → join the waitlist instead of rejecting.
      const result = await joinWaitlist({
        sessionId,
        playerId: session.sub,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        status: "waitlisted",
        position: result.position,
      });
    }

    const dueAt = computePaymentDeadline(sess.start_at);
    if (existing) {
      // Drop-in starts unpaid; player must tap "I paid" before passing the slot.
      await sb
        .from("attendance")
        .update({
          rsvp_status: "in",
          source: "drop_in",
          payment_status: "unpaid",
          payment_due_at: dueAt,
        })
        .eq("id", existing.id);
      return NextResponse.json({ ok: true, status: "in" });
    }
    const { error } = await sb.from("attendance").insert({
      session_id: sessionId,
      player_id: session.sub,
      source: "drop_in",
      rsvp_status: "in",
      payment_status: "unpaid",
      payment_due_at: dueAt,
    });
    if (error)
      return NextResponse.json({ error: "Could not RSVP" }, { status: 500 });
    return NextResponse.json({ ok: true, status: "in" });
  }

  if (action === "drop_in_cancel") {
    if (!existing || existing.source !== "drop_in")
      return NextResponse.json({ error: "No drop-in to cancel" }, { status: 400 });
    await sb
      .from("attendance")
      .update({ rsvp_status: "cancelled" })
      .eq("id", existing.id);
    // Free seat → try to promote oldest waitlisted member.
    await promoteWaitlist(sessionId);
    return NextResponse.json({ ok: true });
  }

  if (action === "waitlist_leave") {
    if (!existing || existing.rsvp_status !== "waitlisted")
      return NextResponse.json({ error: "Not on waitlist" }, { status: 400 });
    await sb
      .from("attendance")
      .update({ rsvp_status: "cancelled" })
      .eq("id", existing.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
