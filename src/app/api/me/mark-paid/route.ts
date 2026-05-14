import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";

const schema = z.object({
  attendanceId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.attendanceId && !parsed.data.subscriptionId))
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  if (parsed.data.attendanceId) {
    const { data: row } = await sb
      .from("attendance")
      .select("*")
      .eq("id", parsed.data.attendanceId)
      .maybeSingle();
    if (!row || row.player_id !== session.sub)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.payment_status === "admin_confirmed")
      return NextResponse.json({ ok: true });

    await sb
      .from("attendance")
      .update({ payment_status: "self_marked_paid" })
      .eq("id", row.id);
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.subscriptionId) {
    const { data: row } = await sb
      .from("subscriptions")
      .select("*")
      .eq("id", parsed.data.subscriptionId)
      .maybeSingle();
    if (!row || row.player_id !== session.sub)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.status === "paid")
      return NextResponse.json({ ok: true });

    await sb
      .from("subscriptions")
      .update({ status: "paid", paid_at: nowIso })
      .eq("id", row.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
