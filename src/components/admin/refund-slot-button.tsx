"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { useAnnounce } from "@/components/ui/live-announcer";

export function RefundSlotButton({ attendanceId }: { attendanceId: string }) {
  const router = useRouter();
  const announce = useAnnounce();

  async function onConfirm() {
    const res = await fetch("/api/admin/referrals/refund-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error ?? "Could not refund slot" };
    }
    announce("Slot refunded");
    router.refresh();
    return { ok: true };
  }

  return (
    <ConfirmActionButton
      label="Refund slot"
      title="Refund this referrer's monthly slot?"
      description="They'll get the slot back so they can refer another guest this month."
      confirmLabel="Refund slot"
      confirmVariant="destructive"
      onConfirm={onConfirm}
    />
  );
}
