import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { hashPin } from "@/lib/auth/pin";
import { consumeInvite } from "@/lib/auth/invite";
import {
  normalizePhone,
  normalizeUsername,
} from "@/lib/auth/rate-limit";

const schema = z.object({
  displayName: z.string().min(2).max(64),
  username: z.string().min(2).max(32),
  pin: z.string().regex(/^\d{6}$/, "PIN must be 6 digits"),
  pinConfirm: z.string(),
  whatsappNumber: z.string().min(6).max(20),
  inviteCode: z.string().min(4).max(64),
  // honeypot field – bots fill it
  hp: z.string().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { displayName, username: rawUser, pin, pinConfirm, whatsappNumber: rawPhone, inviteCode, hp } = parsed.data;
  if (hp) return NextResponse.json({ ok: true }); // silently drop bots
  if (pin !== pinConfirm)
    return NextResponse.json({ error: "PINs do not match" }, { status: 400 });

  const username = normalizeUsername(rawUser);
  const whatsapp = normalizePhone(rawPhone);

  const sb = createServerSupabase();

  // Username + phone uniqueness pre-check (DB also enforces).
  const { data: existing } = await sb
    .from("players")
    .select("id")
    .or(`username.eq.${username},whatsapp_number.eq.${whatsapp}`)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Username or WhatsApp number already used" },
      { status: 409 },
    );
  }

  // Consume invite (atomic check + increment).
  const inv = await consumeInvite(inviteCode);
  if (!inv.ok) {
    return NextResponse.json({ error: inv.error }, { status: 400 });
  }

  const pinHash = await hashPin(pin);

  const { data: created, error } = await sb
    .from("players")
    .insert({
      username,
      display_name: displayName.trim(),
      whatsapp_number: whatsapp,
      pin_hash: pinHash,
      role: "player",
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return NextResponse.json(
      { error: "Could not create account" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, playerId: created.id });
}
