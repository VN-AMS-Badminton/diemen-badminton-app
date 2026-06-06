// Minimal bunq public-API client: just enough to run the auth handshake and
// register a webhook (notification filter). This is used ONLY by the one-off
// setup script (`scripts/bunq-setup.ts`) run locally — the Vercel runtime never
// opens a bunq session, it only RECEIVES callbacks (see app/api/webhooks/bunq).
//
// Auth handshake (per https://doc.bunq.com/):
//   1. POST /v1/installation     (unsigned) — register client public key
//   2. POST /v1/device-server    (signed)   — register device with API key
//   3. POST /v1/session-server   (signed)   — open a session, get user id
// Then POST /v1/user/{id}/notification-filter-url to register the MUTATION webhook.

import { randomUUID } from "node:crypto";
import { signSha256 } from "./sign";

export const BUNQ_PRODUCTION_BASE = "https://api.bunq.com";
export const BUNQ_SANDBOX_BASE = "https://public-api.sandbox.bunq.com";

export interface BunqContext {
  baseUrl: string;
  apiKey: string;
  privateKeyPem: string;
  publicKeyPem: string;
  /** Populated after installation(). */
  installationToken?: string;
  serverPublicKeyPem?: string;
  /** Populated after sessionServer(). */
  sessionToken?: string;
  userId?: number;
}

const COMMON_HEADERS: Record<string, string> = {
  "Cache-Control": "no-cache",
  "User-Agent": "diemen-badminton-app/1.0",
  "X-Bunq-Language": "en_US",
  "X-Bunq-Region": "nl_NL",
  "X-Bunq-Geolocation": "0 0 0 0 000",
};

/** Perform a bunq API call. Signs the body (except for installation). */
async function call(
  ctx: BunqContext,
  method: "GET" | "POST" | "PUT",
  path: string,
  body: unknown,
  opts: { sign: boolean; auth?: string } = { sign: true },
): Promise<unknown> {
  const bodyStr = body === undefined ? "" : JSON.stringify(body);
  const headers: Record<string, string> = {
    ...COMMON_HEADERS,
    "Content-Type": "application/json",
    "X-Bunq-Client-Request-Id": randomUUID(),
  };
  if (opts.auth) headers["X-Bunq-Client-Authentication"] = opts.auth;
  if (opts.sign)
    headers["X-Bunq-Client-Signature"] = signSha256(bodyStr, ctx.privateKeyPem);

  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : bodyStr,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`bunq ${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Find the first object in a bunq `Response[]` array that has the given key. */
function pick(resp: unknown, key: string): Record<string, unknown> | undefined {
  const arr = (resp as { Response?: Array<Record<string, unknown>> })?.Response;
  if (!Array.isArray(arr)) return undefined;
  const hit = arr.find((o) => o && typeof o === "object" && key in o);
  return hit?.[key] as Record<string, unknown> | undefined;
}

/** Step 1 — register the client public key, capture installation token + server key. */
export async function installation(ctx: BunqContext): Promise<void> {
  const resp = await call(
    ctx,
    "POST",
    "/v1/installation",
    { client_public_key: ctx.publicKeyPem },
    { sign: false },
  );
  const token = pick(resp, "Token");
  const serverKey = pick(resp, "ServerPublicKey");
  ctx.installationToken = token?.token as string;
  ctx.serverPublicKeyPem = serverKey?.server_public_key as string;
  if (!ctx.installationToken || !ctx.serverPublicKeyPem)
    throw new Error("installation: missing token or server public key in response");
}

/** Step 2 — register this device/API key. permittedIps ["*"] allows any source IP. */
export async function deviceServer(
  ctx: BunqContext,
  permittedIps: string[] = ["*"],
): Promise<void> {
  await call(
    ctx,
    "POST",
    "/v1/device-server",
    {
      description: "diemen-badminton-app setup",
      secret: ctx.apiKey,
      permitted_ips: permittedIps,
    },
    { sign: true, auth: ctx.installationToken },
  );
}

/** Step 3 — open a session; capture session token + user id. */
export async function sessionServer(ctx: BunqContext): Promise<void> {
  const resp = await call(
    ctx,
    "POST",
    "/v1/session-server",
    { secret: ctx.apiKey },
    { sign: true, auth: ctx.installationToken },
  );
  ctx.sessionToken = (pick(resp, "Token")?.token as string) ?? undefined;
  // The user object key varies: UserPerson / UserCompany / UserApiKey / UserLight.
  for (const key of ["UserPerson", "UserCompany", "UserApiKey", "UserLight"]) {
    const u = pick(resp, key);
    if (u?.id != null) {
      ctx.userId = Number(u.id);
      break;
    }
  }
  if (!ctx.sessionToken || ctx.userId == null)
    throw new Error("session-server: missing session token or user id");
}

/**
 * Register (replace) the user-level URL notification filters. Passing the full
 * desired set makes this idempotent — re-running installs the same single
 * MUTATION filter rather than duplicating it.
 */
export async function registerCallback(
  ctx: BunqContext,
  webhookUrl: string,
  category = "MUTATION",
): Promise<void> {
  if (ctx.userId == null || !ctx.sessionToken)
    throw new Error("registerCallback: call sessionServer() first");
  await call(
    ctx,
    "POST",
    `/v1/user/${ctx.userId}/notification-filter-url`,
    {
      notification_filters: [
        { category, notification_target: webhookUrl },
      ],
    },
    { sign: true, auth: ctx.sessionToken },
  );
}

/** Run the full handshake in order. */
export async function authenticate(ctx: BunqContext): Promise<void> {
  await installation(ctx);
  await deviceServer(ctx);
  await sessionServer(ctx);
}

// ── Sandbox helpers ─────────────────────────────────────────────────────────

/** Create a sandbox API key (sandbox only). Returns the api_key string. */
export async function createSandboxUser(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/sandbox-user-person`, {
    method: "POST",
    headers: { ...COMMON_HEADERS, "X-Bunq-Client-Request-Id": randomUUID() },
  });
  const json = (await res.json()) as { Response?: Array<Record<string, unknown>> };
  const apiKey = json.Response?.find((o) => "ApiKey" in o)?.["ApiKey"] as
    | { api_key?: string }
    | undefined;
  if (!apiKey?.api_key) throw new Error(`sandbox-user-person failed: ${JSON.stringify(json)}`);
  return apiKey.api_key;
}

/** Request test money from Sugar Daddy (sandbox only) to fund the account. */
export async function requestSugarDaddy(
  ctx: BunqContext,
  monetaryAccountId: number,
  amount = "50.00",
): Promise<void> {
  await call(
    ctx,
    "POST",
    `/v1/user/${ctx.userId}/monetary-account/${monetaryAccountId}/request-inquiry`,
    {
      amount_inquired: { value: amount, currency: "EUR" },
      counterparty_alias: { type: "EMAIL", value: "sugardaddy@bunq.com" },
      description: "sandbox top-up",
      allow_bunqme: false,
    },
    { sign: true, auth: ctx.sessionToken },
  );
}
