"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { MyReferralRow, ReferralRowStatus } from "@/lib/referrals/list-my-referrals";

interface Payload {
  code: string;
  remainingSlots: number;
  cap: number;
  monthResetDate: string;
  referrals: MyReferralRow[];
}

// Dashboard widget: permanent link + cap state + referral history. No
// generate/revoke buttons — every active member has one code for life. The
// per-row Cancel button is the only mutation surface here.
export function ReferLinkCard({ initial }: { initial: Payload }) {
  const [payload, setPayload] = React.useState<Payload>(initial);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const link = React.useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/refer/${payload.code}`;
  }, [payload.code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — fallback handled visually
    }
  }

  async function refresh() {
    const res = await fetch("/api/me/referrals");
    if (!res.ok) return;
    const data = await res.json();
    setPayload({
      code: data.code,
      remainingSlots: data.remainingSlots,
      cap: data.cap,
      monthResetDate: data.monthResetDate,
      referrals: data.referrals ?? [],
    });
  }

  async function cancelReferral(attendanceId: string) {
    setError(null);
    setPendingId(attendanceId);
    try {
      const res = await fetch(`/api/me/referrals/${attendanceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not cancel referral");
        return;
      }
      await refresh();
    } finally {
      setPendingId(null);
    }
  }

  const capExhausted = payload.remainingSlots === 0;

  return (
    <Card>
      <CardHeader>
        <p className="overline">Refer a friend</p>
        <CardTitle>Your permanent link</CardTitle>
        <CardDescription>
          Share once. Each friend gets one free trial; you get up to {payload.cap}{" "}
          referrals per calendar month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
          <code className="block break-all rounded bg-background px-2 py-1.5 text-xs">
            {link}
          </code>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={copy} className="flex-1">
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </div>

        <div
          className={
            capExhausted
              ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
              : "rounded-md bg-muted/50 px-3 py-2 text-sm"
          }
        >
          <span className="font-bold tabular-nums">
            {payload.remainingSlots} / {payload.cap}
          </span>{" "}
          referrals left this month
          {capExhausted && (
            <>
              {" "}— link won&apos;t accept new sign-ups until{" "}
              <span className="font-medium">
                {formatDate(payload.monthResetDate)}
              </span>
              .
            </>
          )}
        </div>

        {payload.referrals.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">My referrals</p>
            <ul className="space-y-1.5">
              {payload.referrals.map((r) => (
                <li
                  key={r.attendanceId}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.guestName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.sessionDate ? formatDate(r.sessionDate) : "—"}
                    </div>
                  </div>
                  <StatusChip status={r.status} />
                  {r.status === "tentative" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === r.attendanceId}
                      onClick={() => cancelReferral(r.attendanceId)}
                    >
                      {pendingId === r.attendanceId ? "…" : "Cancel"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
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

function StatusChip({ status }: { status: ReferralRowStatus }) {
  const map: Record<ReferralRowStatus, { label: string; variant: "success" | "warning" | "secondary" | "brand" | "outline" }> = {
    tentative: { label: "tentative", variant: "brand" },
    locked: { label: "locked", variant: "success" },
    attended: { label: "attended", variant: "success" },
    bumped: { label: "bumped", variant: "warning" },
    cancelled: { label: "cancelled", variant: "secondary" },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
