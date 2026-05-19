"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { useAnnounce } from "@/components/ui/live-announcer";

export function ResetTrialButton({ playerId }: { playerId: string }) {
  const router = useRouter();
  const announce = useAnnounce();

  async function onConfirm() {
    const res = await fetch("/api/admin/referrals/reset-trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error ?? "Could not reset trial" };
    }
    announce("Free trial reset");
    router.refresh();
    return { ok: true };
  }

  return (
    <ConfirmActionButton
      label="Reset free trial"
      title="Reset this guest's free trial?"
      description="They'll be eligible to be referred again."
      confirmLabel="Reset"
      confirmVariant="destructive"
      onConfirm={onConfirm}
    />
  );
}
