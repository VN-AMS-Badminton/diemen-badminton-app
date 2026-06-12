import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";
import { normalizePhone } from "@/lib/auth/rate-limit";

const schema = z.object({
  whatsapp_number: z.string().min(6).max(20).optional(),
  role: z.enum(["player", "admin"]).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();
  const { data: before } = await sb
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.whatsapp_number !== undefined)
    updates.whatsapp_number = normalizePhone(parsed.data.whatsapp_number);
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ ok: true });

  const { data: after, error } = await sb
    .from("players")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(session.sub, "edit_player", "player", id, before, after);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;

  if (id === session.sub) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const sb = createServerSupabase();
  const { data: player } = await sb
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!player) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await sb.from("players").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(session.sub, "delete_player", "player", id, player, null);
  return NextResponse.json({ ok: true });
}
