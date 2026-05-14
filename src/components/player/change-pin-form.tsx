"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePinForm() {
  const [currentPin, setCurrentPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [newPinConfirm, setNewPinConfirm] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok?: string; err?: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPin !== newPinConfirm) {
      setMsg({ err: "New PINs do not match" });
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/me/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ err: data?.error ?? "Could not change PIN" });
        return;
      }
      setMsg({ ok: "PIN updated." });
      setCurrentPin("");
      setNewPin("");
      setNewPinConfirm("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-2">
        <Label htmlFor="currentPin">Current PIN</Label>
        <Input
          id="currentPin"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPin">New PIN</Label>
        <Input
          id="newPin"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPinConfirm">Confirm new PIN</Label>
        <Input
          id="newPinConfirm"
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          value={newPinConfirm}
          onChange={(e) => setNewPinConfirm(e.target.value)}
          required
        />
      </div>
      {msg?.err && <p className="text-sm text-destructive">{msg.err}</p>}
      {msg?.ok && <p className="text-sm font-medium text-success">{msg.ok}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating..." : "Change PIN"}
      </Button>
    </form>
  );
}
