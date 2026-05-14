"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface Player {
  id: string;
  username: string;
}

interface Props {
  attendanceId: string;
  fromUsername: string;
  players: Player[];
}

export function AttendanceTransferButton({ attendanceId, fromUsername, players }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [targetPlayerId, setTargetPlayerId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleOpen() {
    setTargetPlayerId("");
    setError(null);
    setOpen(true);
  }

  function handleTransfer() {
    if (!targetPlayerId) {
      setError("Please select a player");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/attendance/${attendanceId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Transfer failed");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        Transfer
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer RSVP</AlertDialogTitle>
            <AlertDialogDescription>
              Transfer <strong>{fromUsername}</strong>&apos;s spot to another player.
              Their RSVP will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label htmlFor="admin-transfer-target" className="text-sm font-medium">
              Transfer to
            </label>
            <select
              id="admin-transfer-target"
              value={targetPlayerId}
              onChange={(e) => setTargetPlayerId(e.target.value)}
              disabled={pending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— select player —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.username}
                </option>
              ))}
            </select>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button onClick={handleTransfer} disabled={pending || !targetPlayerId}>
              {pending ? "Transferring..." : "Confirm transfer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
