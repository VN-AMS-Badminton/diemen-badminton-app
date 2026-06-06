"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SessionTikkieUrlForm({
  sessionId,
  currentUrl,
}: {
  sessionId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = React.useState(currentUrl ?? "");
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tikkie_url: url || null }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Save failed");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="tikkie-url">Payment link for this session</Label>
      <div className="flex gap-2">
        <Input
          id="tikkie-url"
          type="url"
          placeholder="https://tikkie.me/pay/… or https://bunq.me/…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setSaved(false);
          }}
          className="flex-1"
        />
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </div>
      {saved && <p className="text-sm font-medium text-success">Saved.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
