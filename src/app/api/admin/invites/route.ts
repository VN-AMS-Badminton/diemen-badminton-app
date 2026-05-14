import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({
  max_uses: z.number().int().min(1).max(100),
  expires_in_days: z.number().int().min(1).max(180),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();
  const code = crypto.randomBytes(8).toString("base64url");
  const expires = new Date(
    Date.now() + parsed.data.expires_in_days * 86_400_000,
  ).toISOString();

  const { data, error } = await sb
    .from("invites")
    .insert({
      code,
      created_by: session.sub,
      expires_at: expires,
      max_uses: parsed.data.max_uses,
    })
    .select()
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ error: "Create failed" }, { status: 500 });

  await writeAudit(session.sub, "create_invite", "invite", data.id, null, data);
  return NextResponse.json({ ok: true, code: data.code, id: data.id });
}
