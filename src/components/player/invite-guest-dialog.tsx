"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  sessionId: string;
  trialRemaining: number;
}

export function InviteGuestDialog({ sessionId, trialRemaining }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successName, setSuccessName] = React.useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setGuestName("");
      setGuestPhone("");
      setError(null);
      setSuccessName(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/me/sessions/${sessionId}/invite-guest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestName, guestPhone }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong");
        return;
      }
      setSuccessName(data.guestName ?? guestName);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" className="w-full">
          Invite a guest{" "}
          <span className="ml-1 text-xs text-muted-foreground">
            ({trialRemaining} trial slot{trialRemaining === 1 ? "" : "s"} left)
          </span>
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Invite a guest
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            Your guest gets one free trial session. They&apos;ll be registered as
            a player and RSVP&apos;d automatically.
          </DialogPrimitive.Description>

          {successName ? (
            <div className="mt-5 space-y-4">
              <p className="rounded-md bg-success-soft px-4 py-3 text-sm font-medium text-success-soft-foreground">
                {successName} is confirmed for this session!
              </p>
              <DialogPrimitive.Close asChild>
                <Button className="w-full">Done</Button>
              </DialogPrimitive.Close>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ig-name">Guest full name</Label>
                <Input
                  id="ig-name"
                  type="text"
                  placeholder="Jan de Vries"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={64}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ig-phone">Guest phone number</Label>
                <Input
                  id="ig-phone"
                  type="tel"
                  placeholder="+31 6 12345678"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Used to ensure each person can only claim one free trial.
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <DialogPrimitive.Close asChild>
                  <Button variant="outline" disabled={submitting}>
                    Cancel
                  </Button>
                </DialogPrimitive.Close>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Registering…" : "Register guest"}
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
