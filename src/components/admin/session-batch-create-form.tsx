"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Calendar batch session creator. Admin picks any subset of days in the
// season's year_month and a shared time/location/capacity; the API inserts
// one session per selected date (skipping conflicts).

interface Props {
  seasonId: string;
  yearMonth: string; // 'YYYY-MM'
  defaultLocation: string | null;
  // Season-level schedule defaults set on season creation. Used to pre-fill
  // the time input and offer a "Select all {weekday}s" shortcut.
  defaultWeekday: number | null;
  defaultStartTime: string | null;
}

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function SessionBatchCreateForm({
  seasonId,
  yearMonth,
  defaultLocation,
  defaultWeekday,
  defaultStartTime,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [time, setTime] = React.useState(defaultStartTime ?? "19:00");
  const [location, setLocation] = React.useState(defaultLocation ?? "");
  const [capacity, setCapacity] = React.useState(8);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  // Build the month grid: padded leading days so the first row starts on Monday.
  const grid = React.useMemo(() => {
    const [yStr, mStr] = yearMonth.split("-");
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10); // 1-based
    if (!year || !month) return [] as Array<{ date: string | null; weekday: number }>;

    const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // Convert Sunday=0 → Monday=0 so the grid starts on Monday like our headers.
    const leading = (firstDow + 6) % 7;
    const cells: Array<{ date: string | null; weekday: number }> = [];
    for (let i = 0; i < leading; i++) cells.push({ date: null, weekday: i });
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${yStr}-${mStr.padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      cells.push({ date: iso, weekday: dow });
    }
    // pad trailing cells to a multiple of 7 for clean grid rows
    while (cells.length % 7 !== 0) cells.push({ date: null, weekday: 0 });
    return cells;
  }, [yearMonth]);

  function toggleDay(date: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function selectAllOfDefaultWeekday() {
    if (defaultWeekday === null) return;
    const matches = grid
      .filter((c) => c.date && c.weekday === defaultWeekday)
      .map((c) => c.date as string);
    setSelected(new Set(matches));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (selected.size === 0) {
      setError("Pick at least one day");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError("Time must be HH:MM");
      return;
    }

    const dates = Array.from(selected).sort();
    startTransition(async () => {
      const res = await fetch(`/api/admin/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_id: seasonId,
          dates,
          time,
          location,
          capacity,
        }),
      });
      const data = await res.json().catch(() => ({}));
      let created = 0;
      let skipped = 0;
      if (!res.ok) {
        setError(data?.error ?? "Create failed");
      } else {
        created = data.created ?? 0;
        skipped = data.skipped ?? 0;
      }
      setResult(`Created ${created} sessions · skipped ${skipped} existing.`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Click days to toggle. {selected.size} selected.
          </p>
          {defaultWeekday !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllOfDefaultWeekday}
            >
              Select all {WEEKDAY_LONG[defaultWeekday]}s
            </Button>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
          {WEEKDAY_HEADERS.map((h) => (
            <div key={h} className="px-1 py-1">
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, i) => {
            if (!cell.date)
              return <div key={i} className="h-10 rounded-md" aria-hidden />;
            const isSelected = selected.has(cell.date);
            const day = parseInt(cell.date.slice(8, 10), 10);
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => toggleDay(cell.date!)}
                className={
                  "h-10 rounded-md border text-sm font-medium transition-colors " +
                  (isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted")
                }
                aria-pressed={isSelected ? "true" : "false"}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="bsc-time">Start time</Label>
          <Input
            id="bsc-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bsc-location">Location</Label>
          <Input
            id="bsc-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Sporthal Diemen — Court 1+2"
            required
            minLength={1}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bsc-cap">Capacity per session</Label>
          <Input
            id="bsc-cap"
            type="number"
            min={1}
            max={200}
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value || "1", 10))}
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={pending || selected.size === 0}>
        {pending
          ? "Adding..."
          : `Add ${selected.size} ${selected.size === 1 ? "session" : "sessions"}`}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <p className="text-sm font-medium text-success">{result}</p>}
    </form>
  );
}
