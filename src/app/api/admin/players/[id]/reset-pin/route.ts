import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { hashPin } from "@/lib/auth/pin";
import { writeAudit } from "@/lib/admin/audit";

const schema = z.object({ newPin: z.string().regex(/^\d{6}$/) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "PIN must be 6 digits" }, { status: 400 });

  const sb = createServerSupabase();
  const { data: player } = await sb
    .from("players")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!player)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hash = await hashPin(parsed.data.newPin);
  await sb.from("players").update({ pin_hash: hash }).eq("id", id);
  await writeAudit(
    session.sub,
    "reset_pin",
    "player",
    id,
    null, // never log the old or new PIN
    { pin_reset: true },
  );
  return NextResponse.json({ ok: true });
}
