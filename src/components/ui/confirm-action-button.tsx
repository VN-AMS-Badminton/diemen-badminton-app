"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmVariant = "destructive" | "default" | "brand";

interface Props {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  pendingLabel?: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  disabled?: boolean;
}

// Shared confirm-trigger for destructive/admin-style "click → confirm → POST"
// flows. Inline AlertDialog when call-site state needs richer gating.
export function ConfirmActionButton({
  label,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmVariant = "destructive",
  pendingLabel,
  onConfirm,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await onConfirm();
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
    <div className="space-y-1">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerSize}
            disabled={disabled}
            className={triggerClassName}
          >
            {label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handle}
              disabled={pending}
              className={cn(
                buttonVariants({ variant: confirmVariant }),
              )}
            >
              {pending ? (pendingLabel ?? "…") : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
