"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentBlock } from "@/components/player/payment-block";
import { formatDate, formatEuros, formatTime, formatWeekday } from "@/lib/format";

// Trust-first season poll card.
//   * Not subscribed → show session list + total + Subscribe button.
//   * Subscribed (poll open) → show "You're in" + Cancel button.
//   * Subscribed (poll closed) → show "You're in" badge only.
//
// No payment toggling here — admin flags exceptions on reconciliation.
export interface PollSession {
  id: string;
  start_at: string;
  location: string;
}

interface Props {
  seasonId: string;
  yearMonth: string;
  sessions: PollSession[];
  perSessionCents: number;
  tikkieUrl: string;
  username: string;
  isSubscribed: boolean;
  pollOpen: boolean;
}

export function SeasonPollCard({
  seasonId,
  yearMonth,
  sessions,
  perSessionCents,
  tikkieUrl,
  username,
  isSubscribed,
  pollOpen,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const sessionCount = sessions.length;
  const totalCents = sessionCount * perSessionCents;

  function subscribe() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/me/season/${seasonId}/subscribe`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Subscribe failed");
        return;
      }
      router.refresh();
    });
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/me/season/${seasonId}/subscribe`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Cancel failed");
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
          Subscribe to{" "}
          <span className="text-brand tabular-nums">{yearMonth}</span>?
        </CardTitle>
        <CardDescription>
          Subscribers play every scheduled session — one Tikkie covers the
          whole month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessionCount > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p>
              <strong>{sessionCount}</strong> session
              {sessionCount === 1 ? "" : "s"} ×{" "}
              {formatEuros(perSessionCents)} ={" "}
              <strong>{formatEuros(totalCents)}</strong> total
            </p>
          </div>
        )}

        {sessionCount > 0 && (
          <ul className="space-y-1 text-sm">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 border-b border-border/50 pb-1 last:border-b-0"
              >
                <span>
                  <span className="font-medium">{formatWeekday(s.start_at)}</span>{" "}
                  <span className="text-muted-foreground">
                    {formatDate(s.start_at)} · {formatTime(s.start_at)}
                  </span>
                </span>
                {s.location && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {s.location}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {isSubscribed ? (
          <div className="space-y-3">
            <Badge variant="success">
              You&apos;re in for {sessionCount}{" "}
              {sessionCount === 1 ? "session" : "sessions"}
            </Badge>
            <PaymentBlock
              tikkieUrl={tikkieUrl}
              amountCents={totalCents}
              username={username}
              label={`${yearMonth} subscription`}
            />
            {pollOpen && (
              <Button
                variant="outline"
                onClick={cancel}
                disabled={pending}
                className="w-full"
              >
                {pending ? "Cancelling..." : "Cancel subscription"}
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={subscribe}
            disabled={pending || sessionCount === 0 || !pollOpen}
            size="lg"
            className="w-full"
          >
            {pending
              ? "Saving..."
              : sessionCount === 0
                ? "No sessions scheduled yet"
                : !pollOpen
                  ? "Poll closed"
                  : `Subscribe — ${formatEuros(totalCents)}`}
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
