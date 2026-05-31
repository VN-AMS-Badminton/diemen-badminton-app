"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/db/types";

// Edit a session's date / time / location / capacity / status.
// Surfaces 409 (date collision) and 400 (illegal status transition) inline.

interface Props {
  session: {
    id: string;
    start_at: string;
    location: string;
    capacity: number;
    trial_quota: number;
    status: SessionStatus;
  };
  /** Current count of referral guests already invited — sets the minimum for trial_quota. */
  trialUsed: number;
}

function localDateStr(startAt: string) {
  return new Date(startAt).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}
function localTimeStr(startAt: string) {
  return new Date(startAt).toLocaleTimeString("sv-SE", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionEditForm({ session, trialUsed }: Props) {
  const router = useRouter();
  const [date, setDate] = React.useState(() => localDateStr(session.start_at));
  const [time, setTime] = React.useState(() => localTimeStr(session.start_at));
  const [location, setLocation] = React.useState(session.location);
  const [capacity, setCapacity] = React.useState(session.capacity);
  const [trialQuota, setTrialQuota] = React.useState(session.trial_quota);
  const [status, setStatus] = React.useState<SessionStatus>(session.status);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [confirmDoneOpen, setConfirmDoneOpen] = React.useState(false);

  const needsDoneConfirm = status === "done" && session.status !== "done";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (needsDoneConfirm) {
      setConfirmDoneOpen(true);
      return;
    }
    runSave();
  }

  function runSave() {
    setConfirmDoneOpen(false);
    startTransition(async () => {
      const res = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time,
          location,
          capacity,
          trial_quota: trialQuota,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Save failed");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="se-date">Date</Label>
          <Input
            id="se-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-time">Start time</Label>
          <Input
            id="se-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="se-location">Location</Label>
          <Input
            id="se-location"
            type="text"
            placeholder="Sporthal Diemen — Court 2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            minLength={1}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-cap">Capacity</Label>
          <Input
            id="se-cap"
            type="number"
            min={1}
            max={200}
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value || "1", 10))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-trial">Trial slots</Label>
          <Input
            id="se-trial"
            type="number"
            min={trialUsed}
            max={50}
            value={trialQuota}
            onChange={(e) => setTrialQuota(parseInt(e.target.value || "0", 10))}
            required
          />
          {trialUsed > 0 && (
            <p className="text-xs text-muted-foreground">
              Min {trialUsed} — {trialUsed} guest{trialUsed !== 1 ? "s" : ""} already invited
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-status">Status</Label>
          <select
            id="se-status"
            aria-label="Session status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SessionStatus)}
            className="h-11 w-full rounded-md border bg-background px-3"
            disabled={session.status === "done"}
          >
            <option value="scheduled">scheduled</option>
            <option value="cancelled">cancelled</option>
            <option value="done">done</option>
          </select>
        </div>
      </div>
      <Button type="submit" disabled={pending} variant="default">
        {pending ? "Saving..." : "Save changes"}
      </Button>
      {saved && <p className="text-sm font-medium text-success">Saved.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <AlertDialog open={confirmDoneOpen} onOpenChange={setConfirmDoneOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this session as done?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be reversed. The status select will lock after save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runSave}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Yes, mark done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
