"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";

// Destructive delete with AlertDialog confirm that surfaces RSVP count.
// Cascade-deletes attendance rows (existing FK ON DELETE CASCADE).

interface Props {
  sessionId: string;
  rsvpCount: number;
  sessionLabel: string;
}

export function SessionDeleteButton({
  sessionId,
  rsvpCount,
  sessionLabel,
}: Props) {
  const router = useRouter();

  async function onConfirm() {
    const res = await fetch(`/api/admin/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error ?? "Delete failed" };
    }
    router.refresh();
    return { ok: true };
  }

  const rowLabel = `${rsvpCount} attendance row${rsvpCount === 1 ? "" : "s"}`;

  return (
    <ConfirmActionButton
      label="Delete"
      title={`Delete session "${sessionLabel}"?`}
      description={`This will remove ${rowLabel} (RSVPs + payment history).`}
      confirmLabel="Delete"
      pendingLabel="Deleting..."
      confirmVariant="destructive"
      triggerVariant="destructive"
      onConfirm={onConfirm}
    />
  );
}
