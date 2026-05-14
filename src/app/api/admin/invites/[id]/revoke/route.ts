import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const sb = createServerSupabase();

  const { data: before } = await sb
    .from("invites")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: after, error } = await sb
    .from("invites")
    .update({ revoked: true })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(session.sub, "revoke_invite", "invite", id, before, after);
  return NextResponse.json({ ok: true });
}
