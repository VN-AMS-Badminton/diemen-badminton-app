import { createServerSupabase } from "@/lib/supabase/server";

export interface InviteValidation {
  ok: boolean;
  inviteId?: string;
  error?: string;
}

// Validate + atomically consume an invite code.
// Two-step: read, then conditional UPDATE that succeeds only if uses_count
// hasn't changed since the read. Retries on race.
export async function consumeInvite(code: string): Promise<InviteValidation> {
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();

  const { data: invite } = await sb
    .from("invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!invite) return { ok: false, error: "Invalid invite code" };
  if (invite.revoked) return { ok: false, error: "Invite has been revoked" };
  if (invite.expires_at < nowIso)
    return { ok: false, error: "Invite has expired" };
  if (invite.uses_count >= invite.max_uses)
    return { ok: false, error: "Invite has been fully used" };

  // Conditional increment: matches only if uses_count is still the value we read.
  const { data: updated, error: updErr } = await sb
    .from("invites")
    .update({ uses_count: invite.uses_count + 1 })
    .eq("id", invite.id)
    .eq("uses_count", invite.uses_count)
    .select()
    .maybeSingle();

  if (updErr || !updated) {
    return { ok: false, error: "Invite race; please retry" };
  }

  return { ok: true, inviteId: invite.id };
}
