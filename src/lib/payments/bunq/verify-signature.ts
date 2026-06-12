// Verify that an incoming callback genuinely came from bunq.
//
// Implemented with Web Crypto (`crypto.subtle`) so it runs natively on the
// Cloudflare Workers runtime (this app deploys via OpenNext) as well as in Node
// for tests — without depending on `node:crypto` being polyfilled on workerd.
//
// bunq signs the raw callback body with its server private key; we verify with
// the server PUBLIC key captured during installation (stored base64 in
// BUNQ_SERVER_PUBLIC_KEY). Algorithm: RSASSA-PKCS1-v1_5 over SHA-256.
//
// Defense-in-depth: the webhook route ALSO checks a value in the URL path, so
// even if bunq ever omits the signature header we are not relying on it alone.

// Return a concrete ArrayBuffer (not Uint8Array) so the values satisfy
// crypto.subtle's BufferSource parameter types across TS lib versions.
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64.trim());
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function utf8ToArrayBuffer(s: string): ArrayBuffer {
  const enc = new TextEncoder().encode(s);
  const buf = new ArrayBuffer(enc.byteLength);
  new Uint8Array(buf).set(enc);
  return buf;
}

/** Accept either a raw PEM or a base64-encoded PEM (setup script emits base64). */
function toPem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;
  return atob(trimmed); // base64-encoded PEM
}

/** Strip PEM armor and decode the SPKI body to DER bytes. */
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  return base64ToArrayBuffer(body);
}

/**
 * Verify the `X-Bunq-Server-Signature` over the RAW request body.
 * Resolves false on any problem (missing key/sig, malformed) — never throws.
 */
export async function verifyBunqCallback(
  rawBody: string,
  signatureBase64: string | null,
  serverPublicKeyRaw: string | undefined,
): Promise<boolean> {
  if (!signatureBase64 || !serverPublicKeyRaw) return false;
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      pemToDer(toPem(serverPublicKeyRaw)),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64ToArrayBuffer(signatureBase64),
      utf8ToArrayBuffer(rawBody),
    );
  } catch {
    return false;
  }
}
