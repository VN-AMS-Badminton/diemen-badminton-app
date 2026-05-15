"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Destructive delete with confirm-prompt that surfaces RSVP count.
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
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onClick() {
    const msg = `Delete session "${sessionLabel}"?\n\nThis will remove ${rsvpCount} attendance row${rsvpCount === 1 ? "" : "s"} (RSVPs + payment history).`;
    if (!confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Delete failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Deleting..." : "Delete"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
