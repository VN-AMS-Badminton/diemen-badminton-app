"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAnnounce } from "@/components/ui/live-announcer";
import { formatDateTime, formatEuros, playerLabel } from "@/lib/format";
import type { PaymentStatus } from "@/lib/db/types";

// Drop-in payment block. Trust-first for subscribers, but drop-ins must tap
// "I paid" before they can pass their slot. The status prop drives the gate.
//
// The "Copy name" button writes `Display Name (username)` to the clipboard
// when display_name is set, otherwise just the username — this lets the admin
// match the Tikkie payer against either field.
interface Props {
  tikkieUrl: string;
  amountCents: number;
  username: string;
  // Optional. When present, the copied clipboard payload becomes
  // "display_name (username)".
  displayName?: string | null;
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
  displayName,
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

  const copyPayload = playerLabel({ username, display_name: displayName });

  function copyName() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(copyPayload);
      announce("Name copied");
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
        your name (<strong>{copyPayload}</strong>) in the description so the
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
        <Button variant="outline" onClick={copyName}>
          Copy name
        </Button>
        {canSelfConfirm && (
          <Button variant="secondary" onClick={markPaid} disabled={pending}>
            {pending ? "Saving…" : "I paid"}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Please make sure that the Tikkie link is paid. If your paid status
        does not match your payment, the admin can reject your attendance.
      </p>
    </div>
  );
}
