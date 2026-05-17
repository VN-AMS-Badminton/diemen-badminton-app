import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { refundReferrerSlot } from "@/lib/referrals/refund-referrer-slot";

// Admin tool: flip an attendance row's cap_consumed off, restoring a slot
// to the referrer for the current month.
const schema = z.object({ attendanceId: z.string().uuid() });

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const res = await refundReferrerSlot({
    attendanceId: parsed.data.attendanceId,
    adminId: admin.sub,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
