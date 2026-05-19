"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinInput } from "@/components/ui/pin-input";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const usernameRef = React.useRef<HTMLInputElement>(null);
  const pinRef = React.useRef<HTMLInputElement>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  function focusError(msg: string) {
    const lower = msg.toLowerCase();
    if (lower.includes("user") || lower.includes("name")) {
      usernameRef.current?.focus();
    } else if (lower.includes("pin") || lower.includes("password")) {
      pinRef.current?.focus();
    } else {
      errorRef.current?.focus();
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error ?? "Login failed";
        setError(msg);
        focusError(msg);
        return;
      }
      const data = await res.json();
      router.push(data.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          ref={usernameRef}
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <PinInput
          ref={pinRef}
          id="pin"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="\d{4,6}"
          minLength={4}
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
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
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
