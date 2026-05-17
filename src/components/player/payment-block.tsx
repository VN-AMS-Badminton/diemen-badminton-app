"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEuros } from "@/lib/format";

interface Props {
  tikkieUrl: string;
  amountCents: number;
  username: string;
  status: "owed" | "self_marked_paid" | "admin_confirmed";
  target: { attendanceId?: string; subscriptionId?: string };
  label: string;
}

export function PaymentBlock({
  tikkieUrl,
  amountCents,
  username,
  status,
  target,
  label,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [optimisticStatus, setOptimisticStatus] = React.useState(status);

  function copyUsername() {
    if (navigator.clipboard) navigator.clipboard.writeText(username);
  }

  function markPaid() {
    setOptimisticStatus("admin_confirmed");
    startTransition(async () => {
      const res = await fetch("/api/me/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      if (!res.ok) {
        setOptimisticStatus(status);
      } else {
        router.refresh();
      }
    });
  }

  const isPaid =
    optimisticStatus === "admin_confirmed" ||
    optimisticStatus === "self_marked_paid";

  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {isPaid ? (
          <Badge variant="success">Paid</Badge>
        ) : (
          <Badge variant="destructive">Owed: {formatEuros(amountCents)}</Badge>
        )}
      </div>

      {!isPaid && (
        <>
          <p className="text-sm">
            Pay <strong>{formatEuros(amountCents)}</strong> via Tikkie and put
            your username (<strong>{username}</strong>) in the description so
            the admin can match it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={tikkieUrl} target="_blank" rel="noreferrer">
                Open Tikkie
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={copyUsername}>
              Copy username
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={markPaid}
              disabled={pending}
            >
              I paid
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
