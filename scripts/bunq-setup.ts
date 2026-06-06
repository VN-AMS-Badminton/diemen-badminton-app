// One-off bunq setup: run the auth handshake locally and register the MUTATION
// webhook. Run from a trusted machine (NOT Vercel) — the runtime never opens a
// bunq session, it only receives callbacks.
//
// Usage:
//   pnpm bunq:setup --sandbox --create-sandbox-user --register-callback \
//     --webhook-url https://<tunnel>.example.com
//   pnpm bunq:setup --production --register-callback \
//     --webhook-url https://app.example.com
//
// Credentials (keypair, tokens, sandbox api key) persist to .bunq/credentials.json
// (gitignored). Copy the printed BUNQ_* env block into .env.local / Vercel.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  type BunqContext,
  BUNQ_PRODUCTION_BASE,
  BUNQ_SANDBOX_BASE,
  authenticate,
  registerCallback,
  createSandboxUser,
} from "../src/lib/payments/bunq/client";
import { generateKeypair } from "../src/lib/payments/bunq/sign";

const CRED_PATH = ".bunq/credentials.json";

interface Creds {
  baseUrl: string;
  apiKey?: string;
  privateKeyPem: string;
  publicKeyPem: string;
  serverPublicKeyPem?: string;
  webhookSecret: string;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function loadCreds(baseUrl: string): Creds {
  if (existsSync(CRED_PATH)) {
    const c = JSON.parse(readFileSync(CRED_PATH, "utf8")) as Creds;
    c.baseUrl = baseUrl; // allow env switch without regenerating keypair
    return c;
  }
  const kp = generateKeypair();
  return {
    baseUrl,
    privateKeyPem: kp.privateKeyPem,
    publicKeyPem: kp.publicKeyPem,
    webhookSecret: randomBytes(24).toString("hex"),
  };
}

function saveCreds(c: Creds): void {
  mkdirSync(".bunq", { recursive: true });
  writeFileSync(CRED_PATH, JSON.stringify(c, null, 2));
}

async function main(): Promise<void> {
  const sandbox = has("--sandbox");
  const production = has("--production");
  if (sandbox === production) {
    console.error("Specify exactly one of --sandbox | --production");
    process.exit(1);
  }
  const baseUrl = sandbox ? BUNQ_SANDBOX_BASE : BUNQ_PRODUCTION_BASE;
  const creds = loadCreds(baseUrl);

  // API key: sandbox can mint one; otherwise from --api-key or env BUNQ_API_KEY.
  if (has("--create-sandbox-user")) {
    if (!sandbox) throw new Error("--create-sandbox-user is sandbox-only");
    creds.apiKey = await createSandboxUser(baseUrl);
    console.log("Created sandbox user + API key.");
  }
  creds.apiKey = arg("--api-key") ?? process.env.BUNQ_API_KEY ?? creds.apiKey;
  if (!creds.apiKey)
    throw new Error("No API key. Pass --api-key, set BUNQ_API_KEY, or use --create-sandbox-user.");

  const ctx: BunqContext = {
    baseUrl,
    apiKey: creds.apiKey,
    privateKeyPem: creds.privateKeyPem,
    publicKeyPem: creds.publicKeyPem,
  };

  console.log(`Authenticating against ${baseUrl} …`);
  await authenticate(ctx);
  creds.serverPublicKeyPem = ctx.serverPublicKeyPem;
  saveCreds(creds);
  console.log(`✓ Session opened (user id ${ctx.userId}).`);

  if (has("--register-callback")) {
    const appUrl = arg("--webhook-url") ?? process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error("Provide --webhook-url or NEXT_PUBLIC_APP_URL");
    const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/bunq/${creds.webhookSecret}`;
    await registerCallback(ctx, webhookUrl, "MUTATION");
    console.log(`✓ Registered MUTATION callback → ${webhookUrl}`);
  }

  // server public key → base64 so it survives single-line .env / Vercel inputs.
  const b64 = Buffer.from(creds.serverPublicKeyPem ?? "", "utf8").toString("base64");
  console.log("\n── Add these to .env.local / Vercel ──────────────────────────");
  console.log(`BUNQ_WEBHOOK_SECRET=${creds.webhookSecret}`);
  console.log(`BUNQ_SERVER_PUBLIC_KEY=${b64}`);
  console.log("──────────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
