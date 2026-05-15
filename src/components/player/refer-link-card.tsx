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

interface Props {
  // Pre-fetched on the server when the user already has an active invite.
  initialCode: string | null;
}

// Dashboard widget — one active referral link per member. If a code is
// already active it is shown immediately with Copy + Revoke. Otherwise the
// Create button surfaces a fresh single-use link.
export function ReferLinkCard({ initialCode }: Props) {
  const [code, setCode] = React.useState<string | null>(initialCode);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const link = React.useMemo(() => {
    if (!code) return null;
    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/refer/${code}`;
  }, [code]);

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
      setCode(data.code);
    });
  }

  function revoke() {
    if (!confirm("Revoke this link? Your friend won't be able to use it anymore.")) {
      return;
    }
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await fetch("/api/me/referrals", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not revoke link");
        return;
      }
      setCode(null);
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
          One reusable link until a friend claims it. After they sign up you
          can generate a new one. Their next session uses the standard drop-in
          fee.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!code && (
          <Button onClick={generate} disabled={pending} className="w-full">
            {pending ? "Generating..." : "Create referral link"}
          </Button>
        )}
        {code && link && (
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
                onClick={revoke}
                disabled={pending}
              >
                Revoke
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share via WhatsApp. Revoke if you want a fresh link.
            </p>
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
