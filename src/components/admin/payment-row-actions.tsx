"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PaymentStatus } from "@/lib/db/types";

// Trust-first reconciliation: every row defaults to 'assumed_paid'. Admin
// toggles 'flagged' as the exception. The same endpoint flips the state both
// directions.
export function PaymentRowActions({
  attendanceId,
  isFlagged,
}: {
  attendanceId: string;
  isFlagged: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      await fetch("/api/admin/payment/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end">
      <Button
        size="sm"
        variant={isFlagged ? "default" : "outline"}
        onClick={toggle}
        disabled={pending}
      >
        {isFlagged ? "Unflag" : "Flag as unpaid"}
      </Button>
    </div>
  );
}

// Helper used by callers to derive the prop from a payment_status enum value.
export function isPaymentFlagged(status: PaymentStatus): boolean {
  return status === "flagged";
}
