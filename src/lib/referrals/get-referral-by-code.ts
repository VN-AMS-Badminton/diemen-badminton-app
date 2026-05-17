import { createServerSupabase } from "@/lib/supabase/server";

export interface ReferralLookup {
  referrer: {
    id: string;
    displayName: string;
  };
}

// Look up the active referrer by their permanent code. Returns null when the
// code is unknown or its owner is no longer active. Replaces the old
// `getReferralInvite` (which read the `invites` table).
export async function getReferralByCode(
  code: string,
): Promise<ReferralLookup | null> {
  const sb = createServerSupabase();

  const { data: referrer } = await sb
    .from("players")
    .select("id, display_name, status, referral_code")
    .eq("referral_code", code)
    .maybeSingle();

  if (!referrer) return null;
  if (referrer.status !== "active") return null;

  return {
    referrer: {
      id: referrer.id,
      displayName: referrer.display_name,
    },
  };
}
