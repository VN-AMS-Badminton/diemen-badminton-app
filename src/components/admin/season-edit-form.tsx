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

// Season edit form. PATCHes /api/admin/seasons/[id]; surfaces the 409
// `stranded_sessions` flow as an AlertDialog the admin must confirm before
// the edit cancels existing scheduled sessions outside the new schedule.

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

interface Season {
  id: string;
  from_date: string;
  to_date: string;
  poll_opens_at: string;
  poll_closes_at: string;
  court_count: number;
  location: string;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  subscription_fee_per_session_cents: number;
  drop_in_fee_per_session_cents: number;
  tikkie_url_override: string | null;
  status: "poll" | "closed";
}

interface StrandedSession {
  id: string;
  date: string;
  reason: "out_of_range" | "weekday_mismatch";
}

function toLocalDatetimeInput(iso: string): string {
  // datetime-local expects "YYYY-MM-DDTHH:MM". We render in Amsterdam time
  // so admin sees the same value they entered in the create form.
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const part = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function SeasonEditForm({ season }: { season: Season }) {
  const router = useRouter();
  const [fromDate, setFromDate] = React.useState(season.from_date);
  const [toDate, setToDate] = React.useState(season.to_date);
  const [pollOpens, setPollOpens] = React.useState(
    toLocalDatetimeInput(season.poll_opens_at),
  );
  const [pollCloses, setPollCloses] = React.useState(
    toLocalDatetimeInput(season.poll_closes_at),
  );
  const [courts, setCourts] = React.useState(season.court_count);
  const [location, setLocation] = React.useState(season.location);
  const [weekday, setWeekday] = React.useState(season.weekday ?? 2);
  const [startTime, setStartTime] = React.useState(
    season.start_time ?? "19:00",
  );
  const [endTime, setEndTime] = React.useState(season.end_time ?? "21:30");
  const [subFee, setSubFee] = React.useState(
    season.subscription_fee_per_session_cents,
  );
  const [dropFee, setDropFee] = React.useState(
    season.drop_in_fee_per_session_cents,
  );
  const [tikkie, setTikkie] = React.useState(season.tikkie_url_override ?? "");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [stranded, setStranded] = React.useState<StrandedSession[] | null>(
    null,
  );

  const readOnly = season.status === "closed";

  function buildPayload(confirmStranded: boolean) {
    return {
      from_date: fromDate,
      to_date: toDate,
      poll_opens_at: new Date(pollOpens).toISOString(),
      poll_closes_at: new Date(pollCloses).toISOString(),
      court_count: courts,
      location,
      weekday,
      start_time: startTime,
      end_time: endTime,
      subscription_fee_per_session_cents: subFee,
      drop_in_fee_per_session_cents: dropFee,
      tikkie_url_override: tikkie === "" ? null : tikkie,
      confirmStranded,
    };
  }

  function send(confirmStranded: boolean) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/seasons/${season.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(confirmStranded)),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.error === "stranded_sessions") {
        setStranded(data.stranded ?? []);
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? "Save failed");
        return;
      }
      setSuccess(
        `Saved · ${data.cascadeUpdated ?? 0} session(s) updated${
          data.strandedCancelled
            ? ` · ${data.strandedCancelled} cancelled`
            : ""
        }`,
      );
      setStranded(null);
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    send(false);
  }

  if (readOnly) {
    return (
      <p className="text-sm text-muted-foreground">
        Season is closed — editing disabled.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="se-from">From date</Label>
          <Input
            id="se-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-to">To date</Label>
          <Input
            id="se-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-po">Poll opens at</Label>
          <Input
            id="se-po"
            type="datetime-local"
            value={pollOpens}
            onChange={(e) => setPollOpens(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-pc">Poll closes at</Label>
          <Input
            id="se-pc"
            type="datetime-local"
            value={pollCloses}
            onChange={(e) => setPollCloses(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-cc">Court count</Label>
          <Input
            id="se-cc"
            type="number"
            min={1}
            max={20}
            value={courts}
            onChange={(e) => setCourts(parseInt(e.target.value || "1", 10))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-tk">Tikkie URL (optional override)</Label>
          <Input
            id="se-tk"
            value={tikkie}
            onChange={(e) => setTikkie(e.target.value)}
            placeholder="https://tikkie.me/pay/..."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="se-loc">Default location</Label>
          <Input
            id="se-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            minLength={1}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-wd">Weekday</Label>
          <select
            id="se-wd"
            aria-label="Weekday"
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
            required
          >
            {WEEKDAYS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="se-st">Start time</Label>
            <Input
              id="se-st"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="se-et">End time</Label>
            <Input
              id="se-et"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-sf">Sub fee per session (cents)</Label>
          <Input
            id="se-sf"
            type="number"
            value={subFee}
            onChange={(e) => setSubFee(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-df">Drop-in fee per session (cents)</Label>
          <Input
            id="se-df"
            type="number"
            value={dropFee}
            onChange={(e) => setDropFee(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </Button>
      {success && <p className="text-sm font-medium text-success">{success}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <AlertDialog
        open={!!stranded}
        onOpenChange={(o) => !o && setStranded(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {stranded?.length} session(s) outside new schedule?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  These scheduled sessions no longer fit the new schedule and
                  will be marked <strong>cancelled</strong>. Existing RSVPs are
                  preserved but the sessions will not run.
                </p>
                <ul className="list-disc pl-5 text-sm">
                  {(stranded ?? []).map((s) => (
                    <li key={s.id}>
                      {s.date} —{" "}
                      {s.reason === "out_of_range"
                        ? "outside new range"
                        : "wrong weekday"}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStranded(null)}>
              Cancel save
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => send(true)}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Cancel sessions &amp; save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
