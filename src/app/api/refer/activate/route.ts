import { NextResponse } from "next/server";
import { z } from "zod";
import { activateReferralAndRsvp } from "@/lib/referrals/activate-referral";

// Public endpoint (no session required) — called from /refer/<code> when a
// guest submits their name + selected session date. Creates the guest player
// and the free attendance row in one go.
const schema = z.object({
  code: z.string().min(4).max(64),
  displayName: z.string().min(2).max(64),
  sessionId: z.string().uuid(),
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

  const result = await activateReferralAndRsvp({
    code: parsed.data.code,
    displayName: parsed.data.displayName,
    sessionId: parsed.data.sessionId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    sessionDate: result.sessionDate,
  });
}
