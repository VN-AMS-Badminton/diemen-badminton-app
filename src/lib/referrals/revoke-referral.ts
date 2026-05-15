import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

export interface RevokeReferralResult {
  ok: boolean;
  error?: string;
}

// Revoke the caller's active referral invite. Idempotent: a no-op when there
// is no active invite. Only marks invites that belong to the calling player
// so one referrer can't revoke another's link.
export async function revokeActiveReferral(
  referrerId: string,
): Promise<RevokeReferralResult> {
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  const { data: invites } = await sb
    .from("invites")
    .select("id, code, uses_count, max_uses")
    .eq("created_by", referrerId)
    .eq("revoked", false)
    .gt("expires_at", nowIso);

  const active = (invites ?? []).find((i) => i.uses_count < i.max_uses);
  if (!active) {
    // Idempotent — caller can treat this as success.
    return { ok: true };
  }

  const { error } = await sb
    .from("invites")
    .update({ revoked: true })
    .eq("id", active.id)
    .eq("created_by", referrerId);

  if (error) {
    return { ok: false, error: "Could not revoke link" };
  }

  await writeAudit(
    referrerId,
    "revoke_referral",
    "invite",
    active.id,
    { code: active.code },
    { revoked: true },
  );

  return { ok: true };
}
