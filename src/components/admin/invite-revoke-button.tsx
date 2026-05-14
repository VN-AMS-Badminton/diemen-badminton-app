"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function InviteRevokeButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  function revoke() {
    startTransition(async () => {
      await fetch(`/api/admin/invites/${id}/revoke`, { method: "POST" });
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={revoke} disabled={pending}>
      Revoke
    </Button>
  );
}
