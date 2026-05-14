"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PaymentRowActions({
  attendanceId,
  subscriptionId,
  currentStatus,
}: {
  attendanceId?: string;
  subscriptionId?: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function act(endpoint: "confirm" | "flag") {
    startTransition(async () => {
      await fetch(`/api/admin/payment/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, subscriptionId }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      {currentStatus !== "admin_confirmed" && currentStatus !== "paid" && (
        <Button size="sm" onClick={() => act("confirm")} disabled={pending}>
          Confirm
        </Button>
      )}
      {(currentStatus === "admin_confirmed" || currentStatus === "paid") && (
        <Button size="sm" variant="outline" onClick={() => act("flag")} disabled={pending}>
          Flag
        </Button>
      )}
    </div>
  );
}

export function BulkConfirmButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState<number | null>(null);

  function go() {
    if (!confirm("Confirm all self-marked-paid attendees for this session?"))
      return;
    startTransition(async () => {
      const res = await fetch("/api/admin/payment/bulk-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setDone(data.count ?? 0);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button onClick={go} disabled={pending} variant="default">
        Confirm all self-marked
      </Button>
      {done !== null && (
        <p className="text-xs text-muted-foreground">Confirmed {done} row(s).</p>
      )}
    </div>
  );
}
