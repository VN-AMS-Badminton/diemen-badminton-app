import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";

const schema = z.object({
  seasonId: z.string().uuid(),
  action: z.enum(["opt_in", "cancel"]),
});

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  const { data: seasonRow } = await sb
    .from("seasons")
    .select("*")
    .eq("id", parsed.data.seasonId)
    .maybeSingle();
  if (!seasonRow)
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  if (seasonRow.status !== "poll")
    return NextResponse.json({ error: "Poll is closed" }, { status: 400 });
  if (seasonRow.poll_closes_at < nowIso)
    return NextResponse.json({ error: "Poll has ended" }, { status: 400 });

  const { data: existing } = await sb
    .from("subscriptions")
    .select("*")
    .eq("season_id", parsed.data.seasonId)
    .eq("player_id", session.sub)
    .maybeSingle();

  if (parsed.data.action === "opt_in") {
    if (existing) {
      if (existing.status === "cancelled") {
        await sb
          .from("subscriptions")
          .update({ status: "opted_in" })
          .eq("id", existing.id);
      }
      return NextResponse.json({ ok: true });
    }
    await sb.from("subscriptions").insert({
      season_id: parsed.data.seasonId,
      player_id: session.sub,
      status: "opted_in",
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "cancel") {
    if (!existing) return NextResponse.json({ ok: true });
    if (existing.status === "paid" || existing.status === "confirmed")
      return NextResponse.json(
        { error: "Already confirmed — contact admin" },
        { status: 400 },
      );
    await sb
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", existing.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
