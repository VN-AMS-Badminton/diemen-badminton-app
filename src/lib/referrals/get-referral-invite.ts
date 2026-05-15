import { createServerSupabase } from "@/lib/supabase/server";

export interface ReferralInvite {
  inviteId: string;
  code: string;
  expiresAt: string;
  referrer: {
    id: string;
    displayName: string;
  };
}

// Validate a referral invite code without consuming it. Returns null when the
// code is unknown, revoked, expired, fully used, or its creator is no longer
// an active member.
export async function getReferralInvite(
  code: string,
): Promise<ReferralInvite | null> {
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  const { data: invite } = await sb
    .from("invites")
    .select("id, code, created_by, expires_at, max_uses, uses_count, revoked")
    .eq("code", code)
    .maybeSingle();

  if (!invite) return null;
  if (invite.revoked) return null;
  if (invite.expires_at < nowIso) return null;
  if (invite.uses_count >= invite.max_uses) return null;

  const { data: referrer } = await sb
    .from("players")
    .select("id, display_name, status")
    .eq("id", invite.created_by)
    .maybeSingle();

  if (!referrer || referrer.status !== "active") return null;

  return {
    inviteId: invite.id,
    code: invite.code,
    expiresAt: invite.expires_at,
    referrer: {
      id: referrer.id,
      displayName: referrer.display_name,
    },
  };
}
