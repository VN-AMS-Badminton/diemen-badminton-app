import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/get-session";
import { resolvePaymentDeadlines } from "@/lib/sessions/resolve-payment-deadlines";
import { passSlot } from "@/lib/sessions/pass-slot";

const schema = z.object({
  sessionId: z.string().uuid(),
  toPlayerId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { sessionId, toPlayerId } = parsed.data;

  const sb = createServerSupabase();

  // Sweep expired unpaid drop-ins so a just-elapsed passer can't slip through.
  await resolvePaymentDeadlines(sessionId);

  const result = await passSlot({
    sb,
    passerId: session.sub,
    sessionId,
    toPlayerId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true });
}
