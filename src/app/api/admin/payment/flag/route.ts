import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

// Toggle the payment_status of an attendance row between 'assumed_paid' and
// 'flagged'. Trust-first model: every row defaults to assumed_paid; admin uses
// this endpoint to mark exceptions (unpaid no-shows, etc.).
const schema = z.object({
  attendanceId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
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
  if (!before)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextStatus =
    before.payment_status === "flagged" ? "assumed_paid" : "flagged";

  const { data: after, error } = await sb
    .from("attendance")
    .update({ payment_status: nextStatus, marked_by: session.sub })
    .eq("id", parsed.data.attendanceId)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(
    session.sub,
    nextStatus === "flagged"
      ? "flag_attendance_payment"
      : "unflag_attendance_payment",
    "attendance",
    after.id,
    before,
    after,
  );
  return NextResponse.json({ ok: true, payment_status: nextStatus });
}
