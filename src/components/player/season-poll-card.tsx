"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <Card accent>
      <CardHeader>
        <p className="overline">Monthly poll</p>
        <CardTitle>
          Subscribe to <span className="text-brand tabular-nums">{yearMonth}</span>?
        </CardTitle>
        <CardDescription>
          Subscribers play every week this month and pay once. Drop-ins can also
          join individual weeks if there are slots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentStatus === "opted_in" ? (
          <div className="space-y-3">
            <Badge variant="success">You opted in</Badge>
            <Button
              variant="outline"
              onClick={() => act("cancel")}
              disabled={pending}
              className="w-full"
            >
              {pending ? "Cancelling..." : "Cancel opt-in"}
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => act("opt_in")}
            disabled={pending}
            size="lg"
            className="w-full"
          >
            {pending ? "Saving..." : "Yes, sign me up"}
          </Button>
        )}
        {error && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
