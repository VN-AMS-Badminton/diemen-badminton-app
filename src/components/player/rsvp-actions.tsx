"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Action = "opt_out" | "opt_in" | "drop_in_rsvp" | "drop_in_cancel";

export function RsvpAction({
  sessionId,
  action,
  label,
  variant,
}: {
  sessionId: string;
  action: Action;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/me/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action }),
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
    <div className="space-y-1">
      <Button onClick={go} disabled={pending} variant={variant} className="w-full">
        {pending ? "Saving..." : label}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
