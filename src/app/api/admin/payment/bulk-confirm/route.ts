import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();

  const { data: rows } = await sb
    .from("attendance")
    .select("*")
    .eq("session_id", parsed.data.sessionId)
    .eq("rsvp_status", "in")
    .eq("payment_status", "self_marked_paid");

  if (!rows || rows.length === 0) return NextResponse.json({ ok: true, count: 0 });

  for (const r of rows) {
    const { data: after } = await sb
      .from("attendance")
      .update({ payment_status: "admin_confirmed", marked_by: session.sub })
      .eq("id", r.id)
      .select()
      .maybeSingle();
    if (after)
      await writeAudit(
        session.sub,
        "bulk_confirm_payment",
        "attendance",
        r.id,
        r,
        after,
      );
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
