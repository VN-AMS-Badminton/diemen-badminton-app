"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SeasonForm() {
  const router = useRouter();
  const [yearMonth, setYearMonth] = React.useState("");
  const [pollOpens, setPollOpens] = React.useState("");
  const [pollCloses, setPollCloses] = React.useState("");
  const [subFee, setSubFee] = React.useState(550);
  const [dropFee, setDropFee] = React.useState(700);
  const [tikkie, setTikkie] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year_month: yearMonth,
          poll_opens_at: new Date(pollOpens).toISOString(),
          poll_closes_at: new Date(pollCloses).toISOString(),
          subscription_fee_per_session_cents: subFee,
          drop_in_fee_per_session_cents: dropFee,
          tikkie_url_override: tikkie || undefined,
        }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Create failed");
        return;
      }
      router.refresh();
      setYearMonth("");
      setPollOpens("");
      setPollCloses("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ym">Year-Month (e.g. 2026-06)</Label>
          <Input
            id="ym"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            placeholder="2026-06"
            pattern="\d{4}-\d{2}"
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
    </form>
  );
}
