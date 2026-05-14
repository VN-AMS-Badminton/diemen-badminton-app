import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({ playerId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();
  const { data: before } = await sb
    .from("players")
    .select("*")
    .eq("id", parsed.data.playerId)
    .maybeSingle();
  if (!before)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (before.status === "active")
    return NextResponse.json({ ok: true, alreadyActive: true });

  const { data: after, error } = await sb
    .from("players")
    .update({ status: "active" })
    .eq("id", parsed.data.playerId)
    .select()
    .maybeSingle();

  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(session.sub, "approve_player", "player", after.id, before, after);
  return NextResponse.json({ ok: true });
}
