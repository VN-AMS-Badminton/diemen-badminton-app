import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyPin } from "@/lib/auth/pin";
import { signSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
  normalizeUsername,
} from "@/lib/auth/rate-limit";

const schema = z.object({
  username: z.string().min(1).max(64),
  pin: z.string().regex(/^\d{4,6}$/),
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data.username);
  const { pin } = parsed.data;

  const rl = checkRateLimit(username);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterMs / 60000)} min.`,
      },
      { status: 429 },
    );
  }

  const sb = createServerSupabase();
  const { data: player } = await sb
    .from("players")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  // Generic error to avoid username enumeration.
  const genericError = NextResponse.json(
    { error: "Invalid credentials" },
    { status: 401 },
  );

  if (!player) {
    recordFailure(username);
    return genericError;
  }

  if (player.status !== "active") {
    recordFailure(username);
    return NextResponse.json(
      { error: "Account not active. Contact the admin." },
      { status: 403 },
    );
  }

  const ok = await verifyPin(pin, player.pin_hash);
  if (!ok) {
    const result = recordFailure(username);
    if (result.lockedOut) {
      return NextResponse.json(
        { error: "Too many wrong attempts. Locked for 15 minutes." },
        { status: 429 },
      );
    }
    return genericError;
  }

  recordSuccess(username);

  const token = await signSession({ sub: player.id, role: player.role });
  const res = NextResponse.json({ ok: true, role: player.role });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
