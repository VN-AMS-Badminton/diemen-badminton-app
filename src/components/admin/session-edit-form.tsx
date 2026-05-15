"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionStatus } from "@/lib/db/types";

// Edit any scheduled session's date / display label / location / capacity / status.
// Surfaces 409 (date collision) and 400 (illegal status transition) inline.

interface Props {
  session: {
    id: string;
    date: string;
    weekday_time: string;
    location: string;
    capacity: number;
    status: SessionStatus;
  };
}

export function SessionEditForm({ session }: Props) {
  const router = useRouter();
  const [date, setDate] = React.useState(session.date);
  const [weekdayTime, setWeekdayTime] = React.useState(session.weekday_time);
  const [location, setLocation] = React.useState(session.location);
  const [capacity, setCapacity] = React.useState(session.capacity);
  const [status, setStatus] = React.useState<SessionStatus>(session.status);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (status === "done" && session.status !== "done") {
      if (!confirm("Mark this session as done? This cannot be reversed.")) return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          weekday_time: weekdayTime,
          location,
          capacity,
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
          <Label htmlFor="se-label">Display label</Label>
          <Input
            id="se-label"
            type="text"
            placeholder="Thu 19:00"
            value={weekdayTime}
            onChange={(e) => setWeekdayTime(e.target.value)}
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
    </form>
  );
}
