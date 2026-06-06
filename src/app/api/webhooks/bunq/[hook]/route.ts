import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyBunqCallback } from "@/lib/payments/bunq/verify-signature";
import { parseBunqCallback } from "@/lib/payments/bunq/parse-callback";
import { reconcileBunqPayment } from "@/lib/payments/bunq/reconcile";

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
  if (!expected || hook !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the RAW body — signature is computed over exact bytes, so we must not
  // re-serialize a parsed object.
  const rawBody = await req.text();

  const signatureValid = verifyBunqCallback(
    rawBody,
    req.headers.get("X-Bunq-Server-Signature"),
    process.env.BUNQ_SERVER_PUBLIC_KEY,
  );
  // If a server public key is configured we REQUIRE a valid signature. If it is
  // not configured (e.g. early sandbox before capture), the URL value alone
  // gates access and we log that we skipped verification.
  if (process.env.BUNQ_SERVER_PUBLIC_KEY && !signatureValid) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const payment = parseBunqCallback(body);
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
