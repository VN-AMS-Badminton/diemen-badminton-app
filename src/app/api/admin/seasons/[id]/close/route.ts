import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { writeAudit } from "@/lib/admin/audit";

// Close the season's signup poll. After this, players can't subscribe/cancel
// or self-mark anything; admin keeps full reconciliation control.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const sb = createServerSupabase();

  const { data: before } = await sb
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before)
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  if (before.status !== "poll")
    return NextResponse.json(
      { error: "Season is already closed" },
      { status: 400 },
    );

  const { data: after, error } = await sb
    .from("seasons")
    .update({ status: "closed" })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !after)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await writeAudit(session.sub, "close_season", "season", after.id, before, after);
  return NextResponse.json({ ok: true });
}
