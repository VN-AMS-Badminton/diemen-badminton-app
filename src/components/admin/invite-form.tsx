"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm() {
  const router = useRouter();
  const [maxUses, setMaxUses] = React.useState(1);
  const [days, setDays] = React.useState(14);
  const [link, setLink] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_uses: maxUses, expires_in_days: days }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Create failed");
        return;
      }
      const data = await res.json();
      const base =
        process.env.NEXT_PUBLIC_APP_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");
      setLink(`${base}/register?code=${data.code}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="max">Max uses</Label>
          <Input
            id="max"
            type="number"
            min={1}
            max={100}
            value={maxUses}
            onChange={(e) => setMaxUses(parseInt(e.target.value || "1", 10))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="days">Expires in (days)</Label>
          <Input
            id="days"
            type="number"
            min={1}
            max={180}
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value || "1", 10))}
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        Create invite
      </Button>
      {link && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Share this link:</p>
          <code className="block break-all">{link}</code>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
