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

