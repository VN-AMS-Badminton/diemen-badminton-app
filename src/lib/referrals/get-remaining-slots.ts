import { countConsumedSlotsThisMonth } from "@/lib/referrals/count-consumed-slots";

export const MONTHLY_REFERRAL_CAP = 2;

// Remaining referral capacity for the current Amsterdam-local month.
export async function getRemainingSlots(referrerId: string): Promise<number> {
  const used = await countConsumedSlotsThisMonth(referrerId);
  return Math.max(0, MONTHLY_REFERRAL_CAP - used);
}
