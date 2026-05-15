"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookSeasonForm({
  seasonId,
  defaultSubFee,
  defaultDropFee,
}: {
  seasonId: string;
  defaultSubFee: number;
  defaultDropFee: number;
}) {
  const router = useRouter();
  const [courts, setCourts] = React.useState(2);
  const [capacity, setCapacity] = React.useState<number | "">("");
  const [weekday, setWeekday] = React.useState(4); // Thursday
  const [time, setTime] = React.useState("19:00");
  const [subFee, setSubFee] = React.useState(defaultSubFee);
  const [dropFee, setDropFee] = React.useState(defaultDropFee);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !confirm(
        "This will generate sessions and confirm subscribers. Are you sure?",
      )
    )
      return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/seasons/${seasonId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court_count: courts,
          capacity_override: capacity === "" ? undefined : capacity,
          weekday,
          time,
          subscription_fee_per_session_cents: subFee,
          drop_in_fee_per_session_cents: dropFee,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Booking failed");
        return;
      }
      const totalPlanned = data.sessionsGenerated ?? 0;
      const created = data.sessionsCreated ?? totalPlanned;
      const skipped = data.sessionsSkipped ?? 0;
      const subTotal = ((subFee * totalPlanned) / 100).toFixed(2);
      const skippedNote = skipped > 0 ? ` · skipped ${skipped} existing` : "";
      setResult(
        `Created ${created} sessions${skippedNote} · subscription total €${subTotal} (${totalPlanned} × €${(subFee / 100).toFixed(2)}) · confirmed ${data.subscribersConfirmed} subscribers.`,
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
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
          <Label htmlFor="cap">Capacity override</Label>
          <Input
            id="cap"
            type="number"
            min={1}
            placeholder={String(courts * 4)}
            value={capacity}
            onChange={(e) =>
              setCapacity(
                e.target.value === "" ? "" : parseInt(e.target.value, 10),
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weekday">Weekday</Label>
          <select
            id="weekday"
            aria-label="Weekday"
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
            className="h-11 w-full rounded-md border bg-background px-3"
          >
            <option value={1}>Monday</option>
            <option value={2}>Tuesday</option>
            <option value={3}>Wednesday</option>
            <option value={4}>Thursday</option>
            <option value={5}>Friday</option>
            <option value={6}>Saturday</option>
            <option value={0}>Sunday</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Time (HH:MM)</Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
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
      <Button type="submit" disabled={pending} variant="default">
        {pending ? "Booking..." : "Book season & generate sessions"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <p className="text-sm font-medium text-success">{result}</p>}
    </form>
  );
}
