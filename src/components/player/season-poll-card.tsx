"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SeasonPollCard({
  seasonId,
  yearMonth,
  currentStatus,
}: {
  seasonId: string;
  yearMonth: string;
  currentStatus: "opted_in" | "cancelled" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function act(action: "opt_in" | "cancel") {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/me/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscribe to {yearMonth}?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Subscribers play every week this month and pay once. Drop-ins can also
          join individual weeks if there are slots.
        </p>
        {currentStatus === "opted_in" ? (
          <>
            <p className="text-sm font-medium">You opted in.</p>
            <Button variant="outline" onClick={() => act("cancel")} disabled={pending}>
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={() => act("opt_in")} disabled={pending} className="w-full">
            {pending ? "Saving..." : "Yes, sign me up"}
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
