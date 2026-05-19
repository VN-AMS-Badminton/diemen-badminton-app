"use server";

import { requireSession } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribeToPush(
  sub: PushSubscriptionInput,
  userAgent?: string
): Promise<void> {
  if (!sub.endpoint.startsWith("https://")) throw new Error("Invalid endpoint");
  if (!sub.keys.p256dh || !sub.keys.auth) throw new Error("Missing subscription keys");

  const session = await requireSession();
  const sb = createServerSupabase();
  const ua = (userAgent ?? "").slice(0, 512);

  // Try insert first. On unique conflict (same endpoint), refresh keys only if
  // this player already owns that endpoint — never overwrite another player's subscription.
  const { error: insertErr } = await sb.from("push_subscriptions").insert({
    player_id: session.sub,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: ua,
  });

  if (insertErr?.code === "23505") {
    const { error: updateErr } = await sb
      .from("push_subscriptions")
      .update({
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: ua,
        last_seen_at: new Date().toISOString(),
      })
      .eq("endpoint", sub.endpoint)
      .eq("player_id", session.sub); // ownership guard — no-op if different player owns it
    if (updateErr) throw new Error(`subscribeToPush update: ${updateErr.message}`);
    return;
  }

  if (insertErr) throw new Error(`subscribeToPush insert: ${insertErr.message}`);
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  const session = await requireSession();
  const sb = createServerSupabase();

  const { error } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("player_id", session.sub);

  if (error) throw new Error(`unsubscribeFromPush: ${error.message}`);
}
