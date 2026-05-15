import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumeInvite } from "@/lib/auth/invite";
import { writeAudit } from "@/lib/admin/audit";
import { getReferralInvite } from "@/lib/referrals/get-referral-invite";

export interface ActivateReferralResult {
  ok: boolean;
  error?: string;
  playerId?: string;
  attendanceId?: string;
  sessionDate?: string;
}

interface Params {
  code: string;
  displayName: string;
  sessionId: string;
}

// Single submit from /refer/<code>:
//   1. revalidate the invite
//   2. ensure the chosen session is still open & has capacity
//   3. consume the invite (CAS in consumeInvite)
//   4. create the guest player (auto-confirmed, referred_by set, trial used)
//   5. create the attendance row (source=referral, payment n_a)
//
// On any failure after the invite is consumed, we DO NOT have a transaction
// across all writes, but we audit-log enough to let admins recover manually.
export async function activateReferralAndRsvp(
  params: Params,
): Promise<ActivateReferralResult> {
  const displayName = params.displayName.trim();
  if (displayName.length < 2 || displayName.length > 64) {
    return { ok: false, error: "Name must be 2-64 characters" };
  }

  const referral = await getReferralInvite(params.code);
  if (!referral) {
    return { ok: false, error: "This referral link is no longer usable" };
  }

  const sb = createServerSupabase();

  const { data: sess } = await sb
    .from("sessions")
    .select("id, date, capacity, status")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (!sess) return { ok: false, error: "Session not found" };
  if (sess.status !== "scheduled")
    return { ok: false, error: "Session is no longer open" };

  // Past-date guard.
  const sessionDate = new Date(sess.date + "T23:59:59Z");
  if (sessionDate.getTime() < Date.now()) {
    return { ok: false, error: "Session has already passed" };
  }

  // Capacity check.
  const { count } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sess.id)
    .eq("rsvp_status", "in");
  if ((count ?? 0) >= sess.capacity) {
    return { ok: false, error: "That session is already full" };
  }

  // Consume the invite first so we can't accidentally create more than one
  // guest from the same link (CAS inside consumeInvite handles concurrency).
  const inv = await consumeInvite(params.code);
  if (!inv.ok) {
    return { ok: false, error: inv.error ?? "Referral link no longer valid" };
  }

  // Unique placeholder username — guests have no login, so this just needs to
  // satisfy the NOT NULL UNIQUE constraint.
  const placeholderUsername = `guest-${crypto.randomBytes(6).toString("hex")}`;

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
      free_trial_used: true,
    })
    .select("id")
    .maybeSingle();

  if (playerErr || !player) {
    await writeAudit(
      referral.referrer.id,
      "referral_activation_failed",
      "invite",
      referral.inviteId,
      null,
      { error: playerErr?.message, stage: "create_player" },
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
    })
    .select("id")
    .maybeSingle();

  if (attErr || !att) {
    // Clean up the just-created player so admin doesn't see a ghost row.
    await sb.from("players").delete().eq("id", player.id);
    await writeAudit(
      referral.referrer.id,
      "referral_activation_failed",
      "invite",
      referral.inviteId,
      null,
      { error: attErr?.message, stage: "create_attendance" },
    );
    return { ok: false, error: "Could not RSVP guest to session" };
  }

  await writeAudit(
    referral.referrer.id,
    "activate_referral",
    "player",
    player.id,
    null,
    {
      invite_id: referral.inviteId,
      attendance_id: att.id,
      session_id: sess.id,
    },
  );

  return {
    ok: true,
    playerId: player.id,
    attendanceId: att.id,
    sessionDate: sess.date,
  };
}
