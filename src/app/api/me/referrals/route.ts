import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/get-session";
import { createReferralInvite } from "@/lib/referrals/create-referral";

// Generate a fresh single-use referral link for the signed-in member.
// No body is required — each call returns a new code.
export async function POST(_req: Request) {
  const session = await requireSession();

  const result = await createReferralInvite(session.sub);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, code: result.code });
}
