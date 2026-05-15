"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Inline dashboard widget: one click generates a fresh single-use referral
// link, surfaced with a copy button. Member shares the link via WhatsApp.
export function ReferLinkCard() {
  const [link, setLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await fetch("/api/me/referrals", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not create link");
        return;
      }
      const data = await res.json();
      const base =
        process.env.NEXT_PUBLIC_APP_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");
      setLink(`${base}/refer/${data.code}`);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard might be blocked; user can long-press the code to copy.
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="overline">Refer a friend</p>
        <CardTitle>Give a free trial</CardTitle>
        <CardDescription>
          Generate a one-time link. Your friend picks any session this month and
          plays for free — their next session uses the standard drop-in fee.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!link && (
          <Button
            onClick={generate}
            disabled={pending}
            className="w-full"
          >
            {pending ? "Generating..." : "Create referral link"}
          </Button>
        )}
        {link && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <code className="block break-all rounded bg-background px-2 py-1.5 text-xs">
              {link}
            </code>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={copy}
                className="flex-1"
              >
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generate}
                disabled={pending}
              >
                New link
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
