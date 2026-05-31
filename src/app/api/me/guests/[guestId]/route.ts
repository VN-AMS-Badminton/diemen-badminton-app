import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { promoteWaitlist } from "@/lib/waitlist/promote-waitlist";

// Referrer-driven revoke: deletes the guest player row so the phone number
// is freed for a fresh invitation. Attendance cascades via ON DELETE CASCADE.
// Only allowed before the session starts.
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ guestId: string }> },
) {
  const session = await requireSession();
  const { guestId } = await ctx.params;
  const sb = createServerSupabase();

  const { data: guest } = await sb
    .from("players")
    .select("id, referred_by, free_trial_used")
    .eq("id", guestId)
    .maybeSingle();

  if (!guest) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }
  if (guest.referred_by !== session.sub) {
    return NextResponse.json({ error: "Not your referral" }, { status: 403 });
  }

  type AttRow = { session_id: string; sessions: { start_at: string } | null };
  const { data: att } = await sb
    .from("attendance")
    .select("session_id, sessions:session_id(start_at)")
    .eq("player_id", guestId)
    .eq("source", "referral")
    .eq("rsvp_status", "in")
    .maybeSingle();

  if (!att) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }
  const { session_id: sessionId, sessions } = att as unknown as AttRow;
  if (!sessions || new Date(sessions.start_at) <= new Date()) {
    return NextResponse.json(
      { error: "Session has already started — cannot revoke" },
      { status: 400 },
    );
  }

  const { error } = await sb.from("players").delete().eq("id", guestId);
  if (error) {
    return NextResponse.json({ error: "Could not revoke referral" }, { status: 500 });
  }

  await writeAudit(session.sub, "revoke_referral", "player", guestId, guest, null);
  await promoteWaitlist(sessionId);

  return NextResponse.json({ ok: true });
}
