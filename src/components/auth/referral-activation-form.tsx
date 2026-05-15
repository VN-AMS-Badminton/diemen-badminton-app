"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatWeekday } from "@/lib/format";
import { ReferralSessionCalendar } from "@/components/auth/referral-session-calendar";
import type { UpcomingSessionRow } from "@/lib/referrals/list-upcoming-sessions-for-referral";

interface Props {
  inviteCode: string;
  referrerName: string;
  sessions: UpcomingSessionRow[];
}

// Thin orchestrator: hosts the calendar, name input, and submit button.
// All grid rendering / month nav lives inside <ReferralSessionCalendar/>.
export function ReferralActivationForm({
  inviteCode,
  referrerName,
  sessions,
}: Props) {
  const [displayName, setDisplayName] = React.useState("");
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(
    sessions.find((s) => !s.full)?.id ?? null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [doneFor, setDoneFor] = React.useState<UpcomingSessionRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedSessionId) {
      setError("Pick a session to attend");
      return;
    }
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) {
      setError("Pick a session to attend");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/refer/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inviteCode,
          displayName,
          sessionId: selectedSessionId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not activate");
        return;
      }
      setDoneFor(session);
    });
  }

  if (doneFor) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">You&apos;re booked!</h2>
        <p className="text-sm text-muted-foreground">
          See you on{" "}
          <span className="font-semibold text-foreground">
            {formatWeekday(doneFor.date)}, {formatDate(doneFor.date)}
          </span>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          🕒{" "}
          <span className="font-medium text-foreground">
            {doneFor.weekdayTime}
          </span>
        </p>
        {doneFor.location && (
          <p className="text-sm text-muted-foreground">
            📍{" "}
            <span className="font-medium text-foreground">
              {doneFor.location}
            </span>
          </p>
        )}
        <p className="pt-2 text-xs text-muted-foreground">
          {referrerName} will get a notification — feel free to message them
          with any questions.
        </p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">No upcoming sessions</h2>
        <p className="text-sm text-muted-foreground">
          There are no more sessions scheduled. Ask {referrerName} to send a
          fresh link once the next month&apos;s schedule is up.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="displayName">Your full name</Label>
        <Input
          id="displayName"
          autoComplete="name"
          placeholder="e.g. Anna Janssen"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={2}
          maxLength={64}
        />
      </div>

      <div className="space-y-2">
        <Label>Pick a session</Label>
        <ReferralSessionCalendar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelect={setSelectedSessionId}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={pending || !selectedSessionId}
      >
        {pending ? "Booking your spot..." : "Claim my free trial"}
      </Button>
    </form>
  );
}
