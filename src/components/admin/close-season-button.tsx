"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Close the signup poll for a season. After closing, players can no longer
// subscribe or cancel — admin keeps full control of attendance/payments.
export function CloseSeasonButton({ seasonId }: { seasonId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function runClose() {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/seasons/${seasonId}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Close failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? "Closing..." : "Close season"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this season?</AlertDialogTitle>
            <AlertDialogDescription>
              Players will no longer be able to subscribe or cancel. You can
              still flag/unflag payments and manage sessions afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runClose}>
              Yes, close season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
