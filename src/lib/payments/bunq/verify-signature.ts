// Verify that an incoming callback genuinely came from bunq.
//
// bunq signs the raw callback body with its server private key; we verify with
// the server PUBLIC key captured during installation (stored base64 in
// BUNQ_SERVER_PUBLIC_KEY). Algorithm: RSA-SHA256, PKCS#1 v1.5.
//
// Defense-in-depth: the webhook route ALSO checks a secret in the URL path, so
// even if bunq ever omits the signature header we are not relying on it alone.

import { verifySha256 } from "./sign";

/** Accept either a raw PEM or a base64-encoded PEM (setup script emits base64). */
function decodeServerKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;
  try {
    return Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    return trimmed;
  }
}

/**
 * Verify the `X-Bunq-Server-Signature` over the RAW request body.
 * Returns false on any problem (missing key/sig, malformed) — never throws.
 */
export function verifyBunqCallback(
  rawBody: string,
  signatureBase64: string | null,
  serverPublicKeyRaw: string | undefined,
): boolean {
  if (!signatureBase64 || !serverPublicKeyRaw) return false;
  const pem = decodeServerKey(serverPublicKeyRaw);
  return verifySha256(rawBody, signatureBase64, pem);
}
