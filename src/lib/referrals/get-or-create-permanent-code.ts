import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

export interface PermanentCodeResult {
  ok: boolean;
  code?: string;
  error?: string;
}

const MAX_ATTEMPTS = 5;

// Returns the active member's permanent referral code, generating one on first
// call. Idempotent: calling repeatedly for the same player returns the same
// code. Inactive players are rejected.
//
// The migration's inline backfill assigns codes to every active member; this
// helper exists to cover the pending→active transition and any future joiners.
export async function getOrCreatePermanentCode(
  memberId: string,
): Promise<PermanentCodeResult> {
  const sb = createServerSupabase();

  const { data: player } = await sb
    .from("players")
    .select("id, status, referral_code")
    .eq("id", memberId)
    .maybeSingle();
  if (!player) return { ok: false, error: "Player not found" };
  if (player.status !== "active") {
    return { ok: false, error: "Only active members have referral codes" };
  }
  if (player.referral_code) {
    return { ok: true, code: player.referral_code };
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateCode();
    const { data, error } = await sb
      .from("players")
      .update({ referral_code: candidate })
      .eq("id", memberId)
      .is("referral_code", null)
      .select("referral_code")
      .maybeSingle();

    if (!error && data?.referral_code) {
      await writeAudit(memberId, "assign_referral_code", "player", memberId, null, {
        code: data.referral_code,
      });
      return { ok: true, code: data.referral_code };
    }

    // Re-read in case a concurrent caller assigned the code first.
    const { data: refetch } = await sb
      .from("players")
      .select("referral_code")
      .eq("id", memberId)
      .maybeSingle();
    if (refetch?.referral_code) {
      return { ok: true, code: refetch.referral_code };
    }
    // Otherwise it was a unique collision on `candidate` — retry.
  }

  return { ok: false, error: "Could not assign referral code" };
}

// 12 random bytes → ~16 char url-safe base64. ~96 bits entropy; collisions
// effectively impossible but the unique index still guards.
function generateCode(): string {
  return crypto
    .randomBytes(12)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
