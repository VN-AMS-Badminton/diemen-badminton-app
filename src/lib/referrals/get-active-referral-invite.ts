import { createServerSupabase } from "@/lib/supabase/server";

export interface ActiveReferralInvite {
  id: string;
  code: string;
  expiresAt: string;
}

// Returns this referrer's currently-active (not revoked, not expired, not
// fully used) referral invite — if any. Used to enforce the "one active
// referral link per player" rule.
//
// Referrer-created invites are the only kind a non-admin player can produce
// via /api/me/referrals, so a simple `created_by = referrerId` query suffices.
export async function getActiveReferralInvite(
  referrerId: string,
): Promise<ActiveReferralInvite | null> {
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  const { data } = await sb
    .from("invites")
    .select("id, code, expires_at, max_uses, uses_count, revoked")
    .eq("created_by", referrerId)
    .eq("revoked", false)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(5);

  const active = (data ?? []).find((inv) => inv.uses_count < inv.max_uses);
  if (!active) return null;
  return { id: active.id, code: active.code, expiresAt: active.expires_at };
}
