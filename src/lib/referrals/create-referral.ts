import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

export interface CreateReferralResult {
  ok: boolean;
  error?: string;
  code?: string;
}

const INVITE_TTL_DAYS = 30;

// Active member generates a single-use referral invite. The referred guest
// later visits /refer/<code>, enters their name, picks a session, and is
// activated as a player with one free attendance in a single submit.
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

  return { ok: true, code };
}
