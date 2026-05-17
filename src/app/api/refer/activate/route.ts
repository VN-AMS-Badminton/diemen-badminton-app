import { NextResponse } from "next/server";
import { z } from "zod";
import { activateReferralAndRsvp } from "@/lib/referrals/activate-referral";
import { getOptionalSession } from "@/lib/auth/get-session";
import { resolveCutoffIfDue } from "@/lib/sessions/resolve-cutoff";

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

  // Resolve cutoff on the target session so capacity reads are post-cutoff.
  await resolveCutoffIfDue(parsed.data.sessionId);

  const caller = await getOptionalSession();

  const result = await activateReferralAndRsvp({
    code: parsed.data.code,
    displayName: parsed.data.displayName,
    sessionId: parsed.data.sessionId,
    callerId: caller?.sub ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    sessionDate: result.sessionDate,
    lockedAtSignup: !!result.lockedAtSignup,
  });
}
