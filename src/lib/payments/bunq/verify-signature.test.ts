import { describe, expect, it } from "vitest";
import { generateKeypair, signSha256 } from "./sign";
import { verifyBunqCallback } from "./verify-signature";

// Use the client signing path to produce a signature, then verify it with the
// matching public key — exercising the same RSA-SHA256/PKCS#1 v1.5 round-trip
// that bunq uses for callbacks.
const server = generateKeypair();
const other = generateKeypair();
const body = JSON.stringify({ NotificationUrl: { object: { Payment: { id: 1 } } } });
const signature = signSha256(body, server.privateKeyPem);

describe("verifyBunqCallback", () => {
  it("accepts a valid signature (raw PEM key)", async () => {
    expect(await verifyBunqCallback(body, signature, server.publicKeyPem)).toBe(true);
  });

  it("accepts a valid signature (base64-encoded PEM key)", async () => {
    const b64 = Buffer.from(server.publicKeyPem, "utf8").toString("base64");
    expect(await verifyBunqCallback(body, signature, b64)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    expect(await verifyBunqCallback(body + " ", signature, server.publicKeyPem)).toBe(false);
  });

  it("rejects a signature from the wrong key", async () => {
    const wrong = signSha256(body, other.privateKeyPem);
    expect(await verifyBunqCallback(body, wrong, server.publicKeyPem)).toBe(false);
  });

  it("rejects when signature or key is missing", async () => {
    expect(await verifyBunqCallback(body, null, server.publicKeyPem)).toBe(false);
    expect(await verifyBunqCallback(body, signature, undefined)).toBe(false);
  });

  it("does not throw on malformed key material", async () => {
    expect(await verifyBunqCallback(body, signature, "not-a-key")).toBe(false);
  });
});
