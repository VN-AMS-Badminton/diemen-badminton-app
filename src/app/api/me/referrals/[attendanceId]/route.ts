import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/get-session";
import { cancelTentativeReferral } from "@/lib/referrals/cancel-tentative-referral";

interface Ctx {
  params: Promise<{ attendanceId: string }>;
}

// Referrer-driven cancel of a tentative referral. The helper enforces
// ownership (caller must be the guest's referrer) unless invoked with
// isAdmin=true, which this player-facing route never does.
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await requireSession();
  const { attendanceId } = await params;

  const res = await cancelTentativeReferral({
    attendanceId,
    actorId: session.sub,
    isAdmin: false,
  });
  if (!res.ok) {
    const status = res.error === "Not your referral" ? 403 : 409;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
