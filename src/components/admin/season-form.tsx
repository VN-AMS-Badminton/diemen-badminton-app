"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Season-create form. Captures price commitment (per-session fees + court
// count), a default location, the season's date range (from_date / to_date),
// and the weekly schedule template (weekday + start_time + end_time) that
// drives auto-generation of one session per matching weekday in the range.
const WEEKDAYS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

export function SeasonForm() {
  const router = useRouter();
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [pollOpens, setPollOpens] = React.useState("");
  const [pollCloses, setPollCloses] = React.useState("");
  const [courts, setCourts] = React.useState(2);
  const [location, setLocation] = React.useState("");
  const [weekday, setWeekday] = React.useState(6); // Saturday — club's weekly slot
  const [startTime, setStartTime] = React.useState("10:30");
  const [endTime, setEndTime] = React.useState("13:00");
  const [subFee, setSubFee] = React.useState(550);
  const [dropFee, setDropFee] = React.useState(700);
  const [tikkie, setTikkie] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          tikkie_url_override: tikkie || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Create failed");
        return;
      }
      router.refresh();
      setSuccess(
        `Season created · ${data.sessionsCreated ?? 0} session${
          data.sessionsCreated === 1 ? "" : "s"
        } generated`,
      );
      setFromDate("");
      setToDate("");
      setPollOpens("");
      setPollCloses("");
      setLocation("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from-date">From date</Label>
          <Input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to-date">To date</Label>
          <Input
            id="to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="po">Poll opens at</Label>
          <Input
            id="po"
            type="datetime-local"
            value={pollOpens}
            onChange={(e) => setPollOpens(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pc">Poll closes at</Label>
          <Input
            id="pc"
            type="datetime-local"
            value={pollCloses}
            onChange={(e) => setPollCloses(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="courts">Court count</Label>
          <Input
            id="courts"
            type="number"
            min={1}
            max={20}
            value={courts}
            onChange={(e) => setCourts(parseInt(e.target.value || "1", 10))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tikkie">Tikkie URL (optional override)</Label>
          <Input
            id="tikkie"
            value={tikkie}
            onChange={(e) => setTikkie(e.target.value)}
            placeholder="https://tikkie.me/pay/..."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="loc">Default location</Label>
          <Input
            id="loc"
            type="text"
            placeholder="e.g. Sporthal Diemen — Court 1+2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            minLength={1}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wd">Weekday</Label>
          <select
            id="wd"
            aria-label="Weekday"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
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
            <Label htmlFor="st">Start time</Label>
            <Input
              id="st"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="et">End time</Label>
            <Input
              id="et"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sf">Subscription fee per session (cents)</Label>
          <Input
            id="sf"
            type="number"
            value={subFee}
            onChange={(e) => setSubFee(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="df">Drop-in fee per session (cents)</Label>
          <Input
            id="df"
            type="number"
            value={dropFee}
            onChange={(e) => setDropFee(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create season"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm font-medium text-success">{success}</p>}
    </form>
  );
}
