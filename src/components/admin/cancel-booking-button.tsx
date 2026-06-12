"use client";

import { useRouter } from "next/navigation";
import { ReasonConfirmDialog } from "@/components/admin/reason-confirm-dialog";

interface Props {
  attendanceId: string;
  playerName: string;
  /** Trial guest rows are deleted entirely (account + booking), not cancelled. */
  isGuest: boolean;
}

// Admin-only "Cancel booking" action on the session participant list.
export function CancelBookingButton({ attendanceId, playerName, isGuest }: Props) {
  const router = useRouter();

  const description = isGuest
    ? `${playerName} is a trial guest: their guest account is deleted and the phone number becomes available for a fresh invite. The freed seat goes to the longest-waiting waitlisted player.`
    : `Frees the seat immediately — the longest-waiting waitlisted player is promoted. If ${playerName} had already paid, the booking is marked "refund pending"; settle the refund with them personally.`;

  return (
    <ReasonConfirmDialog
      triggerLabel="Cancel booking"
      title={`Cancel ${playerName}'s booking?`}
      description={description}
      confirmLabel="Cancel booking"
      onConfirm={async (reason) => {
        const res = await fetch("/api/admin/bookings/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceId, reason: reason || undefined }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: data?.error ?? "Could not cancel booking" };
        }
        router.refresh();
        return { ok: true };
      }}
    />
  );
}
