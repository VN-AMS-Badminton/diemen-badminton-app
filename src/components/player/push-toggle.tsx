"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/components/ui/live-announcer";
import {
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/notifications/subscribe-actions";
import {
  VAPID_PUBLIC_KEY,
  urlBase64ToUint8Array,
} from "@/lib/notifications/vapid-public-key";

type Status = "unsupported" | "ios-browser" | "denied" | "idle" | "subscribed";

function detectStatus(sub: PushSubscription | null): Status {
  if (typeof window === "undefined") return "idle";
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return "unsupported";
  // iOS Safari outside standalone mode — push not available in the browser tab.
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  if (isIos && !isStandalone) return "ios-browser";
  if (Notification.permission === "denied") return "denied";
  return sub ? "subscribed" : "idle";
}

export function PushToggle() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [busy, setBusy] = React.useState(false);
  const announce = useAnnounce();

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => setStatus(detectStatus(sub)))
      .catch(() => setStatus("idle"));
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        announce("Notifications blocked — change in browser settings to enable.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await subscribeToPush(json, navigator.userAgent);
      setStatus("subscribed");
      announce("Notifications enabled.");
    } catch (err) {
      console.error("[push] subscribe failed", err);
      announce("Could not enable notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unsubscribeFromPush(sub.endpoint);
      }
      setStatus("idle");
      announce("Notifications disabled.");
    } catch (err) {
      console.error("[push] unsubscribe failed", err);
      announce("Could not disable notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Render nothing until the useEffect resolves — avoids button flash on first paint.
  if (status === null) return null;

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  if (status === "ios-browser") {
    return (
      <p className="text-sm text-muted-foreground">
        To receive notifications on iOS, tap the Share button in Safari and
        choose <strong>Add to Home Screen</strong>, then open the app from your
        home screen and enable notifications here.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications are blocked. Go to your browser settings to allow
        notifications for this site, then reload the page.
      </p>
    );
  }

  if (status === "subscribed") {
    return (
      <Button variant="outline" size="sm" disabled={busy} onClick={handleDisable}>
        {busy ? "Disabling…" : "Disable notifications"}
      </Button>
    );
  }

  return (
    <Button variant="default" size="sm" disabled={busy} onClick={handleEnable}>
      {busy ? "Enabling…" : "Enable notifications"}
    </Button>
  );
}
