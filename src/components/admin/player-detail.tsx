"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Player {
  id: string;
  username: string;
  whatsapp_number: string;
  role: "player" | "admin";
  status: "pending" | "active" | "blocked";
}

export function PlayerDetail({ player }: { player: Player }) {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = React.useState(player.whatsapp_number);
  const [role, setRole] = React.useState<Player["role"]>(player.role);
  const [newPin, setNewPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: whatsapp, role }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Save failed");
        return;
      }
      router.refresh();
    });
  }

  function resetPin() {
    if (!/^\d{4,6}$/.test(newPin)) {
      setError("PIN must be 4-6 digits");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/players/${player.id}/reset-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPin }),
        },
      );
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Reset failed");
        return;
      }
      setNewPin("");
      router.refresh();
    });
  }

  function setStatus(status: "active" | "blocked") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/players/${player.id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError(
          (await res.json().catch(() => ({}))).error ?? "Status change failed",
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="space-y-2">
          <Label htmlFor="username">Username (read-only)</Label>
          <Input id="username" value={player.username} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp number</Label>
          <Input
            id="phone"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Player["role"])}
            className="h-11 w-full rounded-md border bg-background px-3"
          >
            <option value="player">Player</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button onClick={save} disabled={pending}>
          Save
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reset PIN</h2>
        <p className="text-sm text-muted-foreground">
          Set a temporary PIN and share it with the player via WhatsApp out of
          band. They can change it after sign-in.
        </p>
        <div className="space-y-2">
          <Label htmlFor="newPin">Temporary PIN (4-6 digits)</Label>
          <Input
            id="newPin"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Reset PIN</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset PIN for {player.username}?</AlertDialogTitle>
              <AlertDialogDescription>
                The new PIN will overwrite the existing one. Tell the player
                out-of-band — it is not stored anywhere readable.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={resetPin} disabled={pending}>
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Status</h2>
        {player.status !== "blocked" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Block player</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Block {player.username}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Blocked players cannot sign in. You can unblock later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => setStatus("blocked")}>
                  Block
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button onClick={() => setStatus("active")} disabled={pending}>
            Unblock
          </Button>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
