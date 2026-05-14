"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton({
  variant = "outline",
}: {
  variant?: "default" | "outline" | "ghost";
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
    <Button onClick={go} variant={variant} disabled={pending}>
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
