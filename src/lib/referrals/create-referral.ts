import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { getActiveReferralInvite } from "@/lib/referrals/get-active-referral-invite";

export interface CreateReferralResult {
  ok: boolean;
  error?: string;
  code?: string;
  /** True when an existing active invite was returned instead of a new one. */
  reused?: boolean;
}

const INVITE_TTL_DAYS = 30;

// Active member generates (or reuses) a single referral invite. Each referrer
// is capped at ONE active invite at a time — calling this when an active one
// already exists returns that same code instead of minting a new row.
//
// "Active" = not revoked, not expired, not fully used. To get a fresh code
// the referrer must revoke their current invite first (see revokeReferralInvite).
//
// No friend-side data is collected here — the referrer just produces a link.
export async function createReferralInvite(
  referrerId: string,
): Promise<CreateReferralResult> {
  const sb = createServerSupabase();

  const { data: referrer } = await sb
    .from("players")
    .select("status")
    .eq("id", referrerId)
    .maybeSingle();
  if (!referrer || referrer.status !== "active") {
    return { ok: false, error: "Only active members can refer" };
  }

  // Reuse path: surface the existing active invite instead of creating clutter.
  const existing = await getActiveReferralInvite(referrerId);
  if (existing) {
    return { ok: true, code: existing.code, reused: true };
  }

  const code = crypto.randomBytes(8).toString("base64url");
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 86_400_000,
  ).toISOString();

  const { data: invite, error } = await sb
    .from("invites")
    .insert({
      code,
      created_by: referrerId,
      expires_at: expiresAt,
      max_uses: 1,
    })
    .select("id")
    .maybeSingle();

  if (error || !invite) {
    return { ok: false, error: "Could not create referral link" };
  }

  await writeAudit(
    referrerId,
    "create_referral",
    "invite",
    invite.id,
    null,
    { code },
  );

  return { ok: true, code, reused: false };
}
