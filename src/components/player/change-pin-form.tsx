"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PinInput } from "@/components/ui/pin-input";

export function ChangePinForm() {
  const [currentPin, setCurrentPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [newPinConfirm, setNewPinConfirm] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok?: string; err?: string } | null>(
    null,
  );
  const [pending, startTransition] = React.useTransition();
  const currentRef = React.useRef<HTMLInputElement>(null);
  const newRef = React.useRef<HTMLInputElement>(null);
  const confirmRef = React.useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPin !== newPinConfirm) {
      setMsg({ err: "New PINs do not match" });
      confirmRef.current?.focus();
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
        const errMsg = data?.error ?? "Could not change PIN";
        setMsg({ err: errMsg });
        const lower = errMsg.toLowerCase();
        if (lower.includes("current")) currentRef.current?.focus();
        else newRef.current?.focus();
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
        <PinInput
          ref={currentRef}
          id="currentPin"
          inputMode="numeric"
          pattern="\d{4,6}"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPin">New PIN (6 digits)</Label>
        <PinInput
          ref={newRef}
          id="newPin"
          inputMode="numeric"
          pattern="\d{6}"
          minLength={6}
          maxLength={6}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPinConfirm">Confirm new PIN</Label>
        <PinInput
          ref={confirmRef}
          id="newPinConfirm"
          inputMode="numeric"
          pattern="\d{6}"
          minLength={6}
          maxLength={6}
          value={newPinConfirm}
          onChange={(e) => setNewPinConfirm(e.target.value)}
          required
        />
      </div>
      {msg?.err && (
        <p className="text-sm text-destructive" role="alert">
          {msg.err}
        </p>
      )}
      {msg?.ok && <p className="text-sm font-medium text-success">{msg.ok}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating..." : "Change PIN"}
      </Button>
    </form>
  );
}
