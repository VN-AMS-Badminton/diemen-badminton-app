import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({
  attendanceId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.attendanceId && !parsed.data.subscriptionId))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();

  if (parsed.data.attendanceId) {
    const { data: before } = await sb
      .from("attendance")
      .select("*")
      .eq("id", parsed.data.attendanceId)
      .maybeSingle();
    if (!before)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: after, error } = await sb
      .from("attendance")
      .update({ payment_status: "admin_confirmed", marked_by: session.sub })
      .eq("id", parsed.data.attendanceId)
      .select()
      .maybeSingle();
    if (error || !after)
      return NextResponse.json({ error: "Update failed" }, { status: 500 });

    await writeAudit(
      session.sub,
      "confirm_attendance_payment",
      "attendance",
      after.id,
      before,
      after,
    );
    return NextResponse.json({ ok: true });
  }

  // subscription path
  const subId = parsed.data.subscriptionId!;
  const { data: before } = await sb
    .from("subscriptions")
    .select("*")
    .eq("id", subId)
    .maybeSingle();
  if (!before)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: after, error } = await sb
    .from("subscriptions")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      marked_by: session.sub,
    })
    .eq("id", subId)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(
    session.sub,
    "confirm_subscription_payment",
    "subscription",
    after.id,
    before,
    after,
  );
  return NextResponse.json({ ok: true });
}
