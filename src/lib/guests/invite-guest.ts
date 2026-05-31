import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

export interface InviteGuestResult {
  ok: boolean;
  error?: string;
  guestName?: string;
}

interface Params {
  sessionId: string;
  referrerId: string;
  guestName: string;
  guestPhone: string;
}

// Build a human-readable username: "guest-john-doe-a3f2".
// The 4-char hex suffix makes collisions on the unique username column negligible.
function guestUsername(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const suffix = crypto.randomBytes(2).toString("hex");
  return `guest-${slug}-${suffix}`;
}

// Normalise phone: keep digits, +, spaces, hyphens. Reject if fewer than 7 digits.
function normalisePhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[^\d+\s\-()]/g, "");
  const digitCount = (cleaned.match(/\d/g) ?? []).length;
  if (digitCount < 7) return null;
  return cleaned;
}

export async function inviteGuest(params: Params): Promise<InviteGuestResult> {
  const guestName = params.guestName.trim();
  if (guestName.length < 2 || guestName.length > 64) {
    return { ok: false, error: "Name must be 2–64 characters" };
  }

  const phone = normalisePhone(params.guestPhone);
  if (!phone) {
    return { ok: false, error: "Enter a valid phone number (at least 7 digits)" };
  }

  const sb = createServerSupabase();

  // 1. Fetch session
  const { data: sess } = await sb
    .from("sessions")
    .select("id, capacity, status, start_at, trial_quota")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (!sess) return { ok: false, error: "Session not found" };
  if (sess.status !== "scheduled") return { ok: false, error: "Session is no longer open" };
  if (new Date(sess.start_at).getTime() <= Date.now()) {
    return { ok: false, error: "Session has already passed" };
  }

  // 2. Phone deduplication — whatsapp_number is the phone field; reject if this
  //    number already has a trial (free_trial_used = true scopes the check to guests)
  const { data: existingGuest } = await sb
    .from("players")
    .select("id")
    .eq("whatsapp_number", phone)
    .eq("free_trial_used", true)
    .maybeSingle();

  if (existingGuest) {
    return {
      ok: false,
      error: "This phone number has already been used for a free trial",
    };
  }

  // 3. Trial quota check
  const { count: trialUsed } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sess.id)
    .eq("source", "referral")
    .eq("rsvp_status", "in");

  if ((trialUsed ?? 0) >= sess.trial_quota) {
    return { ok: false, error: "All trial slots for this session are taken" };
  }

  // 4. Session capacity check (guest occupies a regular slot too)
  const { count: inCount } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sess.id)
    .eq("rsvp_status", "in")
    .is("bumped_at", null);

  if ((inCount ?? 0) >= sess.capacity) {
    return { ok: false, error: "Session is full" };
  }

  // 5. Create guest player — store phone in whatsapp_number (the single phone field)
  const placeholderUsername = guestUsername(guestName);

  const { data: player, error: playerErr } = await sb
    .from("players")
    .insert({
      username: placeholderUsername,
      display_name: guestName,
      whatsapp_number: phone,
      pin_hash: null,
      role: "player",
      status: "active",
      referred_by: params.referrerId,
      free_trial_used: true,
    })
    .select("id")
    .maybeSingle();

  if (playerErr || !player) {
    // 23505 = unique_violation (phone already used, caught at DB level)
    if (playerErr?.code === "23505") {
      return {
        ok: false,
        error: "This phone number has already been used for a free trial",
      };
    }
    return { ok: false, error: "Could not register guest" };
  }

  // 6. Create attendance row
  const { data: att, error: attErr } = await sb
    .from("attendance")
    .insert({
      session_id: sess.id,
      player_id: player.id,
      source: "referral",
      rsvp_status: "in",
      payment_status: "assumed_paid",
      is_tentative: false,
      cap_consumed: false,
    })
    .select("id")
    .maybeSingle();

  if (attErr || !att) {
    await sb.from("players").delete().eq("id", player.id);
    return { ok: false, error: "Could not RSVP guest to session" };
  }

  await writeAudit(
    params.referrerId,
    "invite_guest_trial",
    "attendance",
    att.id,
    null,
    { guest_id: player.id, session_id: sess.id, guest_name: guestName },
  );

  return { ok: true, guestName };
}
