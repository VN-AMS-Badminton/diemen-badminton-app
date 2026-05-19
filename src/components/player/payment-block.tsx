"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAnnounce } from "@/components/ui/live-announcer";
import { formatDateTime, formatEuros } from "@/lib/format";
import type { PaymentStatus } from "@/lib/db/types";

// Drop-in payment block. Trust-first for subscribers, but drop-ins must tap
// "I paid" before they can pass their slot. The status prop drives the gate.
interface Props {
  tikkieUrl: string;
  amountCents: number;
  username: string;
  label: string;
  // Optional self-confirm gate. When attendanceId + status are provided and
  // status === 'unpaid', the "I paid" button is shown.
  attendanceId?: string;
  status?: PaymentStatus;
  // Auto-drop deadline (ISO). Surfaced as a warning so the player knows when
  // their slot gets released.
  paymentDueAt?: string | null;
}

export function PaymentBlock({
  tikkieUrl,
  amountCents,
  username,
  label,
  attendanceId,
  status,
  paymentDueAt,
}: Props) {
  const router = useRouter();
  const announce = useAnnounce();
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState<PaymentStatus | undefined>(
    status,
  );

  const effective = optimistic ?? status;
  const isUnpaid = effective === "unpaid";
  const canSelfConfirm = isUnpaid && !!attendanceId;

  function copyUsername() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(username);
      announce("Username copied");
    }
  }

  function markPaid() {
    if (!attendanceId) return;
    setOptimistic("assumed_paid");
    startTransition(async () => {
      const res = await fetch("/api/me/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId }),
      });
      if (!res.ok) {
        setOptimistic(status);
        return;
      }
      announce("Marked as paid");
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {isUnpaid ? (
          <Badge variant="warning">Unpaid · {formatEuros(amountCents)}</Badge>
        ) : (
          <span className="text-sm font-semibold text-brand tabular-nums">
            {formatEuros(amountCents)}
          </span>
        )}
      </div>
      <p className="text-sm">
        Pay <strong>{formatEuros(amountCents)}</strong> via Tikkie and put
        your username (<strong>{username}</strong>) in the description so the
        admin can match it.
      </p>
      {isUnpaid && paymentDueAt && (
        <p className="text-xs text-warning-foreground">
          Tap <strong>I paid</strong> before{" "}
          <strong>{formatDateTime(paymentDueAt)}</strong> or your slot gets
          released.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={tikkieUrl} target="_blank" rel="noreferrer">
            Open Tikkie
          </a>
        </Button>
        <Button variant="outline" onClick={copyUsername}>
          Copy username
        </Button>
        {canSelfConfirm && (
          <Button variant="secondary" onClick={markPaid} disabled={pending}>
            {pending ? "Saving…" : "I paid"}
          </Button>
        )}
      </div>
    </div>
  );
}
