"use client";

import { useRouter } from "next/navigation";
import { ReasonConfirmDialog } from "@/components/admin/reason-confirm-dialog";

interface Props {
  seasonId: string;
  playerId: string;
  playerName: string;
  /** How many future scheduled sessions the cancel will touch. */
  upcomingCount: number;
}

// Admin-only "Cancel subscription" action on the season subscriber list.
export function CancelSubscriptionButton({
  seasonId,
  playerId,
  playerName,
  upcomingCount,
}: Props) {
  const router = useRouter();

  return (
    <ReasonConfirmDialog
      triggerLabel="Cancel subscription"
      title={`Cancel ${playerName}'s subscription?`}
      description={`Cancels ${playerName}'s booking for the remaining ${upcomingCount} upcoming session${upcomingCount === 1 ? "" : "s"} of this season. Already-played sessions are untouched. Paid sessions are marked "refund pending"; settle the refund personally. Freed seats go to waitlisted players.`}
      confirmLabel="Cancel subscription"
      disabled={upcomingCount === 0}
      onConfirm={async (reason) => {
        const res = await fetch(`/api/admin/seasons/${seasonId}/cancel-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, reason: reason || undefined }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return {
            ok: false,
            error: data?.error ?? "Could not cancel subscription",
          };
        }
        router.refresh();
        return { ok: true };
      }}
    />
  );
}
