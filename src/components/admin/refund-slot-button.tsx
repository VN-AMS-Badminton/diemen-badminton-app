"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefundSlotButton({ attendanceId }: { attendanceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function go() {
    if (
      !confirm("Refund this referrer's monthly slot? They'll get the slot back.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/referrals/refund-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not refund slot");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" onClick={go} disabled={pending}>
        {pending ? "…" : "Refund slot"}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
