"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinInput } from "@/components/ui/pin-input";

export function RegisterForm({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pinConfirm, setPinConfirm] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [hp, setHp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const displayNameRef = React.useRef<HTMLInputElement>(null);
  const usernameRef = React.useRef<HTMLInputElement>(null);
  const whatsappRef = React.useRef<HTMLInputElement>(null);
  const pinRef = React.useRef<HTMLInputElement>(null);
  const pinConfirmRef = React.useRef<HTMLInputElement>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  function focusFromError(msg: string) {
    const lower = msg.toLowerCase();
    if (lower.includes("name")) displayNameRef.current?.focus();
    else if (lower.includes("handle") || lower.includes("username"))
      usernameRef.current?.focus();
    else if (lower.includes("whatsapp") || lower.includes("phone"))
      whatsappRef.current?.focus();
    else if (lower.includes("pin") || lower.includes("password"))
      pinRef.current?.focus();
    else errorRef.current?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin !== pinConfirm) {
      setError("PINs do not match");
      pinConfirmRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
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
        const msg = data?.error ?? "Registration failed";
        setError(msg);
        focusFromError(msg);
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
        <Label htmlFor="displayName">Your name</Label>
        <Input
          ref={displayNameRef}
          id="displayName"
          autoComplete="name"
          placeholder="e.g. Jan de Vries"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={2}
          maxLength={64}
        />
        <p className="text-xs text-muted-foreground">
          Shown to the admin so they know who you are.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Login handle</Label>
        <Input
          ref={usernameRef}
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="e.g. jan"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={2}
          maxLength={32}
        />
        <p className="text-xs text-muted-foreground">
          Used to sign in. Lowercase, no spaces.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp">WhatsApp number (e.g. +31612345678)</Label>
        <Input
          ref={whatsappRef}
          id="whatsapp"
          inputMode="tel"
          autoComplete="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">Choose a 6-digit PIN</Label>
        <PinInput
          ref={pinRef}
          id="pin"
          inputMode="numeric"
          pattern="\d{6}"
          minLength={6}
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pinConfirm">Confirm PIN</Label>
        <PinInput
          ref={pinConfirmRef}
          id="pinConfirm"
          inputMode="numeric"
          pattern="\d{6}"
          minLength={6}
          maxLength={6}
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
        <p
          ref={errorRef}
          className="text-sm text-destructive"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting..." : "Create account"}
      </Button>
    </form>
  );
}
