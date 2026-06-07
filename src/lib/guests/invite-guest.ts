import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";
import { normalizePhone } from "@/lib/auth/rate-limit";

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

// Shape of the jsonb returned by the invite_guest_trial PL/pgSQL function.
interface InviteRpcResult {
  ok: boolean;
  error?: string;
  playerId?: string;
  attendanceId?: string;
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

// Validate and canonicalize phone: strip everything except digits and leading +.
// Uses the same normalizer as the admin player-edit path so both produce identical
// strings and the whatsapp_number unique index correctly catches cross-path duplicates.
function canonicalPhone(raw: string): string | null {
  const canonical = normalizePhone(raw); // keeps only [0-9+]
  const digitCount = (canonical.match(/\d/g) ?? []).length;
  if (digitCount < 7) return null;
  return canonical;
}

export async function inviteGuest(params: Params): Promise<InviteGuestResult> {
  const guestName = params.guestName.trim();
  if (guestName.length < 2 || guestName.length > 64) {
    return { ok: false, error: "Name must be 2–64 characters" };
  }

  const phone = canonicalPhone(params.guestPhone);
  if (!phone) {
    return { ok: false, error: "Enter a valid phone number (at least 7 digits)" };
  }

  const sb = createServerSupabase();

  // Single atomic round trip: session validation + quota/capacity checks +
  // player insert + attendance insert, all running locally in Postgres.
  // Replaces the previous 4 sequential network calls to PostgREST.
  const { data, error } = await sb.rpc("invite_guest_trial", {
    p_session_id:  params.sessionId,
    p_referrer_id: params.referrerId,
    p_guest_name:  guestName,
    p_phone:       phone,
    p_username:    guestUsername(guestName),
  });

  if (error) return { ok: false, error: "Could not register guest" };

  const result = data as InviteRpcResult;

  if (!result.ok) return { ok: false, error: result.error };

  // Fire-and-forget — the DB transaction is already committed.
  writeAudit(
    params.referrerId,
    "invite_guest_trial",
    "attendance",
    result.attendanceId!,
    null,
    { guest_id: result.playerId, session_id: params.sessionId, guest_name: guestName },
  ).catch((err) => console.error("[audit] invite_guest_trial failed", err));

  return { ok: true, guestName };
}
