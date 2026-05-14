import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({
  year_month: z.string().regex(/^\d{4}-\d{2}$/),
  poll_opens_at: z.string(),
  poll_closes_at: z.string(),
  subscription_fee_per_session_cents: z.number().int().min(0),
  drop_in_fee_per_session_cents: z.number().int().min(0),
  tikkie_url_override: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );

  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("seasons")
    .insert({
      year_month: parsed.data.year_month,
      poll_opens_at: parsed.data.poll_opens_at,
      poll_closes_at: parsed.data.poll_closes_at,
      subscription_fee_per_session_cents: parsed.data.subscription_fee_per_session_cents,
      drop_in_fee_per_session_cents: parsed.data.drop_in_fee_per_session_cents,
      tikkie_url_override: parsed.data.tikkie_url_override ?? null,
      court_count: 0,
      status: "poll",
    })
    .select()
    .maybeSingle();

  if (error || !data)
    return NextResponse.json({ error: "Create failed: " + (error?.message ?? "") }, { status: 500 });

  await writeAudit(session.sub, "create_season", "season", data.id, null, data);
  return NextResponse.json({ ok: true, id: data.id });
}
