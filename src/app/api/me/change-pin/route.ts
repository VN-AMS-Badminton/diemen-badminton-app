import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";
import { hashPin, verifyPin } from "@/lib/auth/pin";

const schema = z.object({
  currentPin: z.string().regex(/^\d{4,6}$/),
  newPin: z.string().regex(/^\d{4,6}$/),
});

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const sb = createServerSupabase();
  const { data: player } = await sb
    .from("players")
    .select("*")
    .eq("id", session.sub)
    .maybeSingle();
  if (!player)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await verifyPin(parsed.data.currentPin, player.pin_hash);
  if (!ok)
    return NextResponse.json({ error: "Current PIN is wrong" }, { status: 401 });

  const newHash = await hashPin(parsed.data.newPin);
  await sb.from("players").update({ pin_hash: newHash }).eq("id", player.id);
  return NextResponse.json({ ok: true });
}
