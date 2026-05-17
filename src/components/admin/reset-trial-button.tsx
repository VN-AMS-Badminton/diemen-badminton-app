"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ResetTrialButton({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function go() {
    if (
      !confirm("Reset this guest's free trial? They'll be eligible to be referred again.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/referrals/reset-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not reset trial");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        onClick={go}
        disabled={pending}
      >
        {pending ? "…" : "Reset free trial"}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
