"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({
  variant = "outline",
  onBrand = false,
}: {
  variant?: "default" | "outline" | "ghost";
  onBrand?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  function go() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    });
  }
  return (
    <Button
      onClick={go}
      variant={variant}
      size="sm"
      disabled={pending}
      className={cn(
        onBrand &&
          variant === "ghost" &&
          "text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground",
      )}
    >
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
