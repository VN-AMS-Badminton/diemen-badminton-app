import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({ status: z.enum(["active", "blocked"]) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  if (id === session.sub)
    return NextResponse.json(
      { error: "You cannot block yourself" },
      { status: 400 },
    );

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

  const { data: after, error } = await sb
    .from("players")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(
    session.sub,
    parsed.data.status === "blocked" ? "block_player" : "unblock_player",
    "player",
    id,
    before,
    after,
  );
  return NextResponse.json({ ok: true });
}
