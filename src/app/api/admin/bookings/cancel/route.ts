import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { cancelBooking } from "@/lib/admin/cancel-booking";
import { resolveCutoffIfDue } from "@/lib/sessions/resolve-cutoff";
import { resolvePaymentDeadlines } from "@/lib/sessions/resolve-payment-deadlines";

// Admin cancels one player's booking for a session on their behalf.
// Only admins can cancel — players have no equivalent for paid bookings.
const schema = z.object({
  attendanceId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();

  // Resolve cutoff + expired drop-in deadlines first so the cancel sees the
  // reconciled state (same ordering as the player RSVP route).
  const { data: att } = await sb
    .from("attendance")
    .select("session_id")
    .eq("id", parsed.data.attendanceId)
    .maybeSingle();
  if (!att)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  await resolveCutoffIfDue(att.session_id);
  await resolvePaymentDeadlines(att.session_id);

  const result = await cancelBooking({
    sb,
    actorId: session.sub,
    attendanceId: parsed.data.attendanceId,
    reason: parsed.data.reason || undefined,
  });
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, mode: result.mode });
}
