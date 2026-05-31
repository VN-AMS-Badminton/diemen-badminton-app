import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/get-session";
import { listMyReferrals } from "@/lib/referrals/list-my-referrals";

export async function GET(_req: Request) {
  const session = await requireSession();
  const referrals = await listMyReferrals(session.sub);
  return NextResponse.json({ ok: true, referrals });
}
