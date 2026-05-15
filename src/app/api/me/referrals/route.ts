import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/get-session";
import { createReferralInvite } from "@/lib/referrals/create-referral";
import { revokeActiveReferral } from "@/lib/referrals/revoke-referral";

// Generate (or surface the existing) single-use referral link for the
// signed-in member. Each member is capped at one active link at a time.
export async function POST(_req: Request) {
  const session = await requireSession();

  const result = await createReferralInvite(session.sub);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    code: result.code,
    reused: result.reused ?? false,
  });
}

// Revoke the caller's active referral link so a fresh one can be generated.
export async function DELETE(_req: Request) {
  const session = await requireSession();
  const result = await revokeActiveReferral(session.sub);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
