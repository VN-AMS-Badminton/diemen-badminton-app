"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EligiblePlayer = { id: string; username: string; display_name: string };

export function PassSlotDialog({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [players, setPlayers] = React.useState<EligiblePlayer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function fetchEligiblePlayers() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/me/rsvp/eligible-recipients?sessionId=${sessionId}`,
      );
      const data = await res.json();
      setPlayers(data.players ?? []);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelectedId(null);
      setError(null);
      fetchEligiblePlayers();
    }
  }

  async function handleConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/rsvp/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, toPlayerId: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Failed to pass slot");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" className="w-full">
          Pass my slot
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Pass your slot
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            Select a player to take your spot. They pay you directly — not
            tracked in the app.
          </DialogPrimitive.Description>

          <div className="mt-4 max-h-60 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">
                Loading players…
              </p>
            ) : players.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No eligible players available.
              </p>
            ) : (
              players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent",
                    selectedId === p.id && "bg-accent font-medium",
                  )}
                >
                  <span>{p.display_name || p.username}</span>
                  {p.display_name && (
                    <span className="text-xs text-muted-foreground">
                      @{p.username}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogPrimitive.Close asChild>
              <Button variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogPrimitive.Close>
            <Button
              onClick={handleConfirm}
              disabled={!selectedId || submitting}
            >
              {submitting ? "Passing…" : "Confirm pass"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
