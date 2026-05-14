"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

interface PendingPlayer {
  id: string;
  username: string;
  whatsapp_number: string;
  created_at: string;
}

export function ApprovalQueue({ players }: { players: PendingPlayer[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function act(playerId: string, action: "approve" | "reject") {
    setPendingId(playerId);
    setError(null);
    const res = await fetch(`/api/admin/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    setPendingId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  if (players.length === 0) {
    return (
      <EmptyState
        title="No pending approvals"
        description="When players register via invite, they'll show up here."
      />
    );
  }

  return (
    <>
      {error && <p className="mb-2 text-sm text-destructive" role="alert">{error}</p>}
      <Table>
        <THead>
          <TR>
            <TH>Username</TH>
            <TH>WhatsApp</TH>
            <TH>Registered</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {players.map((p) => (
            <TR key={p.id}>
              <TD className="font-medium">{p.username}</TD>
              <TD className="text-muted-foreground">{p.whatsapp_number}</TD>
              <TD className="text-muted-foreground">
                {new Date(p.created_at).toLocaleString("nl-NL", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Amsterdam",
                })}
              </TD>
              <TD>
                <Badge variant="warning">pending</Badge>
              </TD>
              <TD className="space-x-2 text-right">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => act(p.id, "approve")}
                  disabled={pendingId === p.id}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(p.id, "reject")}
                  disabled={pendingId === p.id}
                >
                  Reject
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </>
  );
}
