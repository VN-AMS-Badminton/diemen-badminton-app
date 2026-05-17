import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({
  attendanceId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
});

// Honor-system payment: when a player marks themselves paid, lock the slot in
// immediately. Admin no longer needs to manually confirm — see audit_log for
// the self-confirmation trail (action: "self_confirm_*").
export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.attendanceId && !parsed.data.subscriptionId))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  if (parsed.data.attendanceId) {
    const { data: before } = await sb
      .from("attendance")
      .select("*")
      .eq("id", parsed.data.attendanceId)
      .maybeSingle();
    if (!before || before.player_id !== session.sub)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (before.payment_status === "admin_confirmed")
      return NextResponse.json({ ok: true });

    const { data: after } = await sb
      .from("attendance")
      .update({ payment_status: "admin_confirmed" })
      .eq("id", before.id)
      .select()
      .maybeSingle();
    if (after)
      await writeAudit(
        session.sub,
        "self_confirm_attendance_payment",
        "attendance",
        after.id,
        before,
        after,
      );
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.subscriptionId) {
    const { data: before } = await sb
      .from("subscriptions")
      .select("*")
      .eq("id", parsed.data.subscriptionId)
      .maybeSingle();
    if (!before || before.player_id !== session.sub)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (before.status === "paid")
      return NextResponse.json({ ok: true });

    const { data: after } = await sb
      .from("subscriptions")
      .update({ status: "paid", paid_at: nowIso })
      .eq("id", before.id)
      .select()
      .maybeSingle();
    if (after)
      await writeAudit(
        session.sub,
        "self_confirm_subscription_payment",
        "subscription",
        after.id,
        before,
        after,
      );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
