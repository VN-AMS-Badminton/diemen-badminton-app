"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Add a session ad-hoc to a booked/active season.
// Pre-fills weekday_time, location, capacity from the most recent session as a hint.

interface Props {
  seasonId: string;
  defaults?: {
    weekday_time?: string;
    location?: string | null;
    capacity?: number;
  };
}

export function SessionCreateForm({ seasonId, defaults }: Props) {
  const router = useRouter();
  const [date, setDate] = React.useState("");
  const [weekdayTime, setWeekdayTime] = React.useState(
    defaults?.weekday_time ?? "",
  );
  const [location, setLocation] = React.useState(defaults?.location ?? "");
  const [capacity, setCapacity] = React.useState<number>(
    defaults?.capacity ?? 8,
  );
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_id: seasonId,
          date,
          weekday_time: weekdayTime,
          location: location || null,
          capacity,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Create failed");
        return;
      }
      setResult(
        `Session added · ${data.attendanceCreated} subscriber RSVPs auto-created.`,
      );
      setDate("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="sc-date">Date</Label>
          <Input
            id="sc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sc-label">Display label</Label>
          <Input
            id="sc-label"
            type="text"
            placeholder="Thu 19:00"
            value={weekdayTime}
            onChange={(e) => setWeekdayTime(e.target.value)}
            required
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="sc-location">Location (optional)</Label>
          <Input
            id="sc-location"
            type="text"
            placeholder="Sporthal Diemen — Court 2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sc-cap">Capacity</Label>
          <Input
            id="sc-cap"
            type="number"
            min={1}
            max={200}
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value || "1", 10))}
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending} variant="default">
        {pending ? "Adding..." : "Add session"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <p className="text-sm font-medium text-success">{result}</p>}
    </form>
  );
}
