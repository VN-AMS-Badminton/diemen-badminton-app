// Low-level RSA helpers for the bunq API context.
//
// bunq's public API (v1) signs only the raw request BODY with the client's
// RSA private key (SHA256, PKCS#1 v1.5), base64-encoded, in the
// `X-Bunq-Client-Signature` header. Callbacks bunq sends us are signed the
// same way with bunq's server key — see `verify-signature.ts`, which reuses
// `verifySha256` from here.
//
// Node's built-in `crypto` covers all of this; we deliberately avoid an SDK.

import {
  generateKeyPairSync,
  createSign,
  createVerify,
} from "node:crypto";

export interface RsaKeypair {
  /** PKCS#8 PEM private key. */
  privateKeyPem: string;
  /** SPKI PEM public key (the one bunq stores during installation). */
  publicKeyPem: string;
}

/** Generate a fresh 2048-bit RSA keypair in the PEM encodings bunq expects. */
export function generateKeypair(): RsaKeypair {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

/** Sign a request body with the client private key → base64 signature. */
export function signSha256(data: string, privateKeyPem: string): string {
  const signer = createSign("RSA-SHA256");
  signer.update(data, "utf8");
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

/**
 * Verify an RSA-SHA256 / PKCS#1 v1.5 signature against a public key.
 * Returns false (never throws) on malformed input so callers can treat any
 * failure as "reject".
 */
export function verifySha256(
  data: string | Buffer,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, "base64");
  } catch {
    return false;
  }
}
