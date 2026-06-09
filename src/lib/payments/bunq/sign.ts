// Low-level RSA helpers for the bunq API context. Used ONLY by the local
// one-off setup script (scripts/bunq-setup.ts), which runs in Node — so
// `node:crypto` is fine here. The runtime callback verification lives in
// `verify-signature.ts` and uses Web Crypto instead (Workers-compatible).
//
// bunq's public API (v1) signs only the raw request BODY with the client's
// RSA private key (SHA256, PKCS#1 v1.5), base64-encoded, in the
// `X-Bunq-Client-Signature` header.

import { generateKeyPairSync, createSign } from "node:crypto";

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
