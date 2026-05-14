"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pinConfirm, setPinConfirm] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [hp, setHp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin !== pinConfirm) {
      setError("PINs do not match");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          pin,
          pinConfirm,
          whatsappNumber: whatsapp,
          inviteCode,
          hp,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Registration failed");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Account submitted</h2>
        <p className="text-sm text-muted-foreground">
          The admin will approve your account shortly. You&apos;ll be able to
          sign in once approved.
        </p>
        <Button onClick={() => router.push("/")} className="w-full">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={2}
          maxLength={32}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp">WhatsApp number (e.g. +31612345678)</Label>
        <Input
          id="whatsapp"
          inputMode="tel"
          autoComplete="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">Choose a 4-digit PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          minLength={4}
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pinConfirm">Confirm PIN</Label>
        <Input
          id="pinConfirm"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          minLength={4}
          maxLength={4}
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value)}
          required
        />
      </div>
      {/* honeypot */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting..." : "Create account"}
      </Button>
    </form>
  );
}
