import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/get-session";
import { getOrCreatePermanentCode } from "@/lib/referrals/get-or-create-permanent-code";
import { getRemainingSlots, MONTHLY_REFERRAL_CAP } from "@/lib/referrals/get-remaining-slots";
import { listMyReferrals } from "@/lib/referrals/list-my-referrals";

// Dashboard payload for the ReferLinkCard. Returns the member's permanent
// code, monthly cap state, and a referral history list. No mutations here —
// generate/revoke are gone with the invite model.
export async function GET(_req: Request) {
  const session = await requireSession();

  const codeRes = await getOrCreatePermanentCode(session.sub);
  if (!codeRes.ok || !codeRes.code) {
    return NextResponse.json({ error: codeRes.error ?? "No code" }, { status: 400 });
  }

  const [remainingSlots, referrals] = await Promise.all([
    getRemainingSlots(session.sub),
    listMyReferrals(session.sub),
  ]);

  return NextResponse.json({
    ok: true,
    code: codeRes.code,
    remainingSlots,
    cap: MONTHLY_REFERRAL_CAP,
    monthResetDate: nextMonthFirstDayIso(),
    referrals,
  });
}

// First-of-next-month ISO date used to render "resets on …" copy.
function nextMonthFirstDayIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}
