"use client";

import * as React from "react";
import { Button, buttonVariants, type ButtonProps } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** Receives the (possibly empty) reason the admin typed. */
  onConfirm: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  triggerVariant?: ButtonProps["variant"];
  disabled?: boolean;
}

// ConfirmActionButton variant with an optional free-text reason field, used
// by admin cancellation flows (reason is stored in the audit log).
export function ReasonConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  triggerVariant = "outline",
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const reasonId = React.useId();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setReason("");
      setError(null);
    }
  }

  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await onConfirm(reason.trim());
      if (!result.ok) {
        setError(result.error ?? "Action failed");
        return;
      }
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size="sm"
          disabled={disabled}
        >
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={reasonId}>Reason (optional)</Label>
          <Input
            id={reasonId}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. requested via WhatsApp"
            disabled={pending}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={handle}
            disabled={pending}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {pending ? "…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
