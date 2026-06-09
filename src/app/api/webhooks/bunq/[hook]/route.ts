import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyBunqCallback } from "@/lib/payments/bunq/verify-signature";
import { parseBunqCallback } from "@/lib/payments/bunq/parse-callback";
import { reconcileBunqPayment } from "@/lib/payments/bunq/reconcile";

// Constant-time string compare (avoids leaking the secret via timing). Pure JS
// so it runs on the Cloudflare Workers runtime without node:crypto. Length is
// not secret (a mismatch returns early); the value comparison is constant-time.
function secretsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// bunq MUTATION callback receiver.
//
// Auth is belt-and-suspenders: (1) the BUNQ_WEBHOOK_SECRET value carried in the
// URL path segment (registered with bunq by scripts/bunq-setup.ts), and (2) the
// X-Bunq-Server-Signature over the raw body. Node runtime is required for RSA
// verification via `crypto`.
//
// Status-code contract (avoids bunq retry storms):
//   401 → bad path value or bad signature  (do NOT process)
//   400 → malformed/unparseable body       (no point retrying)
//   200 → processed, INCLUDING "no match"   (we handled it; nothing to retry)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hook: string }> },
) {
  const { hook } = await params;
  const expected = process.env.BUNQ_WEBHOOK_SECRET;
  if (!expected || !secretsEqual(hook, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the RAW body — signature is computed over exact bytes, so we must not
  // re-serialize a parsed object.
  const rawBody = await req.text();

  // Signature gate. If the server public key is configured we REQUIRE a valid
  // signature. If it is NOT configured: fail closed in production (a missing
  // key in prod is a misconfiguration, not a reason to drop a security check);
  // outside production allow URL-secret-only auth for early sandbox testing,
  // and log loudly that verification was skipped.
  const serverKey = process.env.BUNQ_SERVER_PUBLIC_KEY;
  if (serverKey) {
    const signatureValid = await verifyBunqCallback(
      rawBody,
      req.headers.get("X-Bunq-Server-Signature"),
      serverKey,
    );
    if (!signatureValid) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error(
      "[bunq webhook] BUNQ_SERVER_PUBLIC_KEY is not set in production — refusing unverified callback",
    );
    return NextResponse.json({ error: "Server misconfigured" }, { status: 401 });
  } else {
    console.warn(
      "[bunq webhook] BUNQ_SERVER_PUBLIC_KEY unset — skipping signature verification (non-production only)",
    );
  }

  // Sandbox aid: log the raw callback so we can confirm bunq's exact MUTATION
  // shape against the parser. Gate behind BUNQ_DEBUG; never enable in prod.
  if (process.env.BUNQ_DEBUG) {
    console.log("[bunq webhook] raw callback body:", rawBody);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const payment = parseBunqCallback(body);
  if (process.env.BUNQ_DEBUG) {
    console.log("[bunq webhook] parsed payment:", JSON.stringify(payment));
  }
  if (!payment) {
    // Not a payment-bearing callback we understand (e.g. a non-MUTATION event).
    // Acknowledge so bunq doesn't retry.
    return NextResponse.json({ ok: true, outcome: "ignored" });
  }

  try {
    const result = await reconcileBunqPayment(createServerSupabase(), payment);
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (err) {
    // Reconcile failed unexpectedly — return 200 to avoid retry storms but log.
    console.error("bunq reconcile error", {
      paymentId: payment.paymentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true, outcome: "error_logged" });
  }
}
