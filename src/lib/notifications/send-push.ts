import "server-only";

import webpush from "web-push";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PushPayload } from "./push-payload";

type SendResult = { sent: number; failed: number; removed: number };

let vapidInitialized = false;

function ensureVapidInit() {
  if (vapidInitialized) return;

  const vapidSubject = process.env.VAPID_SUBJECT;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    throw new Error(
      "Missing VAPID env vars: VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY must all be set.",
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  vapidInitialized = true;
}

export async function sendPushToPlayers(
  playerIds: string[],
  payload: PushPayload,
): Promise<SendResult> {
  ensureVapidInit();
  if (playerIds.length === 0) return { sent: 0, failed: 0, removed: 0 };

  const sb = createServerSupabase();
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("player_id", playerIds);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, removed: 0 };

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      ),
    ),
  );

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      const code = (result.reason as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        staleIds.push(subs[i].id);
      } else {
        console.error("[push] send failed", result.reason);
        failed++;
      }
    }
  });

  if (staleIds.length > 0) {
    const { error: cleanupErr } = await sb
      .from("push_subscriptions")
      .delete()
      .in("id", staleIds);
    if (cleanupErr) console.error("[push] stale cleanup failed", cleanupErr.message);
  }

  return { sent, failed, removed: staleIds.length };
}
