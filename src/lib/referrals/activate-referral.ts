import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { getReferralByCode } from "@/lib/referrals/get-referral-by-code";
import { getRemainingSlots } from "@/lib/referrals/get-remaining-slots";

export interface ActivateReferralResult {
  ok: boolean;
  error?: string;
  playerId?: string;
  attendanceId?: string;
  sessionDate?: string;
  // True when the row was created already locked-in (sub-24h fallback path).
  lockedAtSignup?: boolean;
}

interface Params {
  code: string;
  displayName: string;
  sessionId: string;
  // Optional caller id — when set, guards against a member referring themselves.
  callerId?: string | null;
}

const CUTOFF_MS = 24 * 60 * 60 * 1000;

// Activate a referral. Replaces the legacy single-use invite flow:
//   1. resolve referrer by permanent code
//   2. enforce monthly cap (2 / referrer)
//   3. self-referral guard
//   4. session checks (scheduled, future, non-bumped seat available)
//   5. branch on cutoff window:
//        pre-cutoff  → row created tentative, trial NOT yet used
//        post-cutoff → row created already-locked, trial used immediately
//   6. create guest player + attendance + audit
export async function activateReferralAndRsvp(
  params: Params,
): Promise<ActivateReferralResult> {
  const displayName = params.displayName.trim();
  if (displayName.length < 2 || displayName.length > 64) {
    return { ok: false, error: "Name must be 2-64 characters" };
  }

  const referral = await getReferralByCode(params.code);
  if (!referral) {
    return { ok: false, error: "This referral link is no longer usable" };
  }

  if (params.callerId && params.callerId === referral.referrer.id) {
    return { ok: false, error: "You can't use your own referral link" };
  }

  const remaining = await getRemainingSlots(referral.referrer.id);
  if (remaining <= 0) {
    return {
      ok: false,
      error: "Your referrer has no slots left this month — ask again next month",
    };
  }

  const sb = createServerSupabase();

  const { data: sess } = await sb
    .from("sessions")
    .select("id, date, capacity, status, start_at")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (!sess) return { ok: false, error: "Session not found" };
  if (sess.status !== "scheduled") {
    return { ok: false, error: "Session is no longer open" };
  }

  const startAtMs = new Date(sess.start_at).getTime();
  if (startAtMs <= Date.now()) {
    return { ok: false, error: "Session has already passed" };
  }

  // Capacity check ignores bumped rows and ignores waitlisted rows.
  const { count } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sess.id)
    .eq("rsvp_status", "in")
    .is("bumped_at", null);
  const inCount = count ?? 0;

  const postCutoff = startAtMs - Date.now() < CUTOFF_MS;
  if (postCutoff && inCount >= sess.capacity) {
    return { ok: false, error: "Session is already locked-in and full" };
  }
  if (!postCutoff && inCount >= sess.capacity) {
    // Pre-cutoff and full: guest still gets a tentative seat by occupying one;
    // a waitlisted member will displace them at cutoff. Allow.
  }

  const placeholderUsername = `guest-${crypto.randomBytes(6).toString("hex")}`;
  const lockedAtSignup = postCutoff;

  const { data: player, error: playerErr } = await sb
    .from("players")
    .insert({
      username: placeholderUsername,
      display_name: displayName,
      whatsapp_number: null,
      pin_hash: null,
      role: "player",
      status: "active",
      referred_by: referral.referrer.id,
      free_trial_used: lockedAtSignup,
    })
    .select("id")
    .maybeSingle();

  if (playerErr || !player) {
    await writeAudit(
      referral.referrer.id,
      "referral_activation_failed",
      "player",
      "unknown",
      null,
      { error: playerErr?.message, stage: "create_player", code: params.code },
    );
    return { ok: false, error: "Could not register guest" };
  }

  const { data: att, error: attErr } = await sb
    .from("attendance")
    .insert({
      session_id: sess.id,
      player_id: player.id,
      source: "referral",
      rsvp_status: "in",
      payment_status: "n_a",
      is_tentative: !lockedAtSignup,
      cap_consumed: true,
    })
    .select("id")
    .maybeSingle();

  if (attErr || !att) {
    // Clean up dangling guest row so it doesn't pollute admin views.
    await sb.from("players").delete().eq("id", player.id);
    await writeAudit(
      referral.referrer.id,
      "referral_activation_failed",
      "player",
      player.id,
      null,
      { error: attErr?.message, stage: "create_attendance", code: params.code },
    );
    return { ok: false, error: "Could not RSVP guest to session" };
  }

  await writeAudit(
    referral.referrer.id,
    "activate_referral",
    "attendance",
    att.id,
    null,
    {
      code: params.code,
      guest_id: player.id,
      session_id: sess.id,
      locked_at_signup: lockedAtSignup,
    },
  );

  return {
    ok: true,
    playerId: player.id,
    attendanceId: att.id,
    sessionDate: sess.date,
    lockedAtSignup,
  };
}
