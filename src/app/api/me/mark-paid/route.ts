import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

// Drop-in self-confirm: flips an unpaid drop-in attendance row to
// `assumed_paid`. Required step before the player can pass their slot.
// Subscribers don't hit this endpoint — their slots are paid up front.
const schema = z.object({
  attendanceId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();

  const { data: before } = await sb
    .from("attendance")
    .select("*")
    .eq("id", parsed.data.attendanceId)
    .maybeSingle();
  if (!before || before.player_id !== session.sub)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (before.source !== "drop_in")
    return NextResponse.json(
      { error: "Only drop-in slots need self-confirm" },
      { status: 400 },
    );

  // Idempotent: already paid or admin-flagged → no-op.
  if (before.payment_status !== "unpaid")
    return NextResponse.json({ ok: true, payment_status: before.payment_status });

  const { data: after, error } = await sb
    .from("attendance")
    .update({ payment_status: "assumed_paid" })
    .eq("id", before.id)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(
    session.sub,
    "self_confirm_attendance_payment",
    "attendance",
    after.id,
    before,
    after,
  );

  return NextResponse.json({ ok: true, payment_status: after.payment_status });
}
