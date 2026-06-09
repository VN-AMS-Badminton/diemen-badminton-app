# Bunq Webhook Auto-Reconciliation

**Status:** IMPLEMENTED (2026-06-07), behind `PAYMENT_PROVIDER=bunq`. Tikkie
remains available for rollback. Sandbox verification + production cutover are
operator steps — see "Implementation status" below and the rollout section in
`docs/deployment-guide.md`.

**Last reviewed:** 2026-06-07

## Implementation status

What shipped (see code):
- Provider flag + provider-aware payment link: `src/lib/payments/provider.ts`,
  `src/lib/sessions/get-payment-context.ts`.
- bunq API client + signing (one-off setup only): `src/lib/payments/bunq/{client,sign}.ts`,
  `scripts/bunq-setup.ts` (`pnpm bunq:setup`).
- Webhook receiver (Node runtime): `src/app/api/webhooks/bunq/[hook]/route.ts`
  — URL-secret + `X-Bunq-Server-Signature` (RSA-SHA256) auth.
- Pure logic + reconcile: `src/lib/payments/bunq/{verify-signature,parse-callback,match-payment,reconcile}.ts`
  with vitest coverage (`src/lib/payments/bunq/*.test.ts`).
- Reconciliation UI badge: `src/app/admin/reconciliation/page.tsx`.

Design changes vs the original sketch below:
- **Static bunq.me link**, not runtime `RequestInquiry` — KISS at this scale.
- **Runtime never authenticates with bunq.** The handshake + callback
  registration run once, locally, via the setup script; the app only RECEIVES
  callbacks and verifies them with the stored server public key. This removes
  the keypair-persistence / static-IP concerns entirely.
- **Deploy target is Cloudflare Workers** (OpenNext) — NOT Vercel or Fly (those
  appear in older docs and are stale). The webhook signature check therefore uses
  **Web Crypto** (`crypto.subtle`), which is native on workerd, not `node:crypto`.
- **Trust-first model**: the enum is `assumed_paid | flagged | unpaid` (not the
  `owed/admin_confirmed` states below). Webhook actions: `unpaid` drop-in →
  `assumed_paid`; `flagged` → auto-unflag on exact match; `assumed_paid` → attach
  `bunq_payment_id` proof. Subscription-sized + ambiguous payments → admin queue.
- **URL-path secret** added alongside signature verification (defense-in-depth).

The original design notes below are kept for context (some details superseded).

---

## Staging Test Runbook

End-to-end test of the bunq integration on staging (`dev.vn-ams-badminton.com`)
using the bunq **sandbox**. Deploy target is Cloudflare Workers.

### Prerequisites
- Branch deployed to staging, and staging rebuilt after the latest push.
- Migration `0024_attendance_bunq_payment_id_unique.sql` applied to **staging's**
  Supabase DB.
- bunq sandbox access (the setup script can mint a sandbox user).

### 1. Confirm the webhook route is reachable (not behind the login gate)
```bash
curl -i -X POST https://dev.vn-ams-badminton.com/api/webhooks/bunq/bogus -d '{}'
# expect HTTP 401 — NOT 307 → /?next=… (307 means the build predates the
# /api/webhooks middleware allowlist; redeploy).
```

### 2. Register the sandbox callback → staging
```bash
pnpm bunq:setup --sandbox --create-sandbox-user --register-callback \
  --webhook-url https://dev.vn-ams-badminton.com
```
Creates a sandbox user + API key, runs the handshake, registers the MUTATION
callback, and prints `BUNQ_WEBHOOK_SECRET` + `BUNQ_SERVER_PUBLIC_KEY`.

### 3. Set staging Worker secrets
Dashboard (Workers & Pages → Worker → Settings → Variables and Secrets) or
`npx wrangler secret put`:

| Name | Value |
|---|---|
| `BUNQ_WEBHOOK_SECRET` | printed value |
| `BUNQ_SERVER_PUBLIC_KEY` | printed base64 |
| `BUNQ_DEFAULT_URL` | a bunq.me / test link |
| `PAYMENT_PROVIDER` | `bunq` |
| `BUNQ_DEBUG` | `1` (logs raw callback + parsed payment; remove after) |

### 4. Seed test data on staging (easy to forget)
The webhook matches against the **nearest upcoming scheduled session**. Create:
- a scheduled session in the near future, and
- a **drop-in** attendance row for a known player, status `unpaid`, whose season
  `drop_in_fee_per_session_cents` equals the amount you will pay.

Note the player's **username** and the **drop-in fee** (cents).

### 5. Trigger an incoming sandbox payment
Send money INTO the sandbox account with **description = player username** and
**amount = drop-in fee**. In sandbox, generate income via Sugar Daddy
(`sugardaddy@bunq.com`) fulfilling a `request-inquiry`, or a second sandbox user.
The request description is what the matcher reads.

### 6. Verify
```bash
npx wrangler tail        # watch staging logs
```
Expect (from `BUNQ_DEBUG`): `raw callback body:` → `parsed payment:` → outcome
`confirmed`. Then on **admin → reconciliation**: the player's row shows
`paid via bunq <id>` + an `audit_log` row (action `bunq_confirmed`).

Other outcomes and what they mean: `unclear` (name/amount didn't match —
check seed data + amount), `subscription_manual` (amount equals the season
total, left for admin), `duplicate` (same payment id already processed),
`no_session` (no upcoming scheduled session).

### 7. Tear down
Set `PAYMENT_PROVIDER=tikkie` and remove `BUNQ_DEBUG`.

### Caveats
- **Shared secrets:** if `dev.vn-ams-badminton.com` is the *same* Worker as prod
  (not a separate env), these secrets are shared with production. Safe only
  because prod serves the last *deployed* version, not the branch. Confirm.
- **Cloudflare WAF:** if Bot Fight Mode / WAF is on for `dev.`, add a skip rule
  for `/api/webhooks/*` so bunq's server-to-server POST isn't challenged.
- **Signature path:** once `BUNQ_SERVER_PUBLIC_KEY` is set, a real bunq callback
  must pass `X-Bunq-Server-Signature` verification; a 401 "Bad signature" means
  the stored key doesn't match the sandbox installation that registered the
  callback (re-run step 2, set the freshly printed key).

---

## When to Build This

Trigger any one of:
- 30+ active subscribers OR weekly drop-ins consistently > 8
- KvK obtained → Bunq Business onboarding viable
- Manual reconciliation time exceeds 30 min/week for 2 consecutive weeks
- More than 1 payment dispute in a single month

If none of the above are true, don't build this. The honor-system + admin reconciliation flow scales to ~50 players with the current UI.

## End-State Flow

```
Player pays via Tikkie/iDEAL/SEPA
  → money lands in Bunq account
  → Bunq POST /api/webhooks/bunq with payment payload
  → webhook handler:
      1. Verify signature (Bunq's RSA public key)
      2. Parse payment description for username
      3. Find matching attendance or subscription row
         where payment_status IN ('owed', 'self_marked_paid')
         and amount matches expected fee
      4. Set payment_status='admin_confirmed', bunq_payment_id=<bunq id>
      5. Append audit_log row (actor=null, action='bunq_confirm')
      6. Return 200
  → on 0 matches or >1 matches: leave row alone, admin sees flagged item
```

## Data Model (already in place — no migration needed)

The phase 02 schema reserved these nullable columns specifically for this:
- `attendance.bunq_payment_id text`
- `subscriptions.bunq_payment_id text`

When set, the admin reconciliation UI should render a small badge: `paid via Bunq <truncated-id>`.

## Bunq Account Setup

Two viable paths:

1. **Bunq Personal**, manual webhook config via API
   - €0/mo base, €0.99 per SEPA/iDEAL credit (verify pricing at implementation time)
   - Single account holder (you)
   - Webhook (Callback) registration via API: `POST /v1/user/<id>/monetary-account/<id>/notification-filter-url`
2. **Bunq Business / KvK**
   - €9.99/mo base (verify)
   - Club-owned account, easier accounting separation
   - Same webhook API surface

**Recommendation:** start with Personal until KvK obtained.

## API Reference (pin to current docs at implementation time)

- Bunq API docs: https://doc.bunq.com/
- Callbacks/Webhooks: https://doc.bunq.com/not-so-basics/callbacks-webhooks
- IP allowlist (verify Bunq publishes static IPs): https://doc.bunq.com/

## Implementation Phases

### Phase B.1 — Sandbox + Local Tunnel
1. Bunq sandbox account
2. Generate API key
3. Set up local tunnel: `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`
4. Register webhook URL pointing to tunnel
5. Trigger sandbox payment, log payload to understand shape

### Phase B.2 — Webhook Handler
1. `src/app/api/webhooks/bunq/route.ts` — POST endpoint, edge runtime (low latency, no Node deps)
2. `src/lib/payments/bunq-signature.ts` — RSA verify using Bunq's published public key (cache in module scope)
3. `src/lib/payments/bunq-webhook.ts` — main handler
4. `src/lib/payments/match-description.ts` — pure function
5. Use Bunq sandbox payments to drive integration tests

### Phase B.3 — Production Cutover
1. Register production webhook with real account
2. Add `BUNQ_WEBHOOK_SECRET` + `BUNQ_SERVER_PUBLIC_KEY` as Cloudflare Worker secrets (`BUNQ_API_KEY` is setup-script-only, never on the Worker)
3. Monitor first week of payments; admin still does spot-check
4. After 2 weeks of clean automatic confirmation, drop daily reconciliation cadence

## Description-Matching Algorithm

```typescript
function matchDescription(description: string, players: { id: string; username: string }[]) {
  const normalized = description.toLowerCase().trim().replace(/\s+/g, " ");
  const exact = players.filter(p => normalized.includes(p.username.toLowerCase()));
  if (exact.length === 1) return { player: exact[0], confidence: "high" };
  // fuzzy fallback: Levenshtein <= 2 against each word in description
  const fuzzy = players.filter(p => fuzzyContains(normalized, p.username.toLowerCase()));
  if (fuzzy.length === 1) return { player: fuzzy[0], confidence: "medium" };
  return { player: null, confidence: "none" };
}
```

If `confidence !== "high"`: do NOT auto-confirm. Append an `audit_log` row with action='bunq_match_unclear', leave row in current state so admin can manually reconcile.

## Amount Matching

After username match, verify the payment amount equals either:
- `season.subscription_fee_cents` (subscription Tikkie) → match against unpaid subscription
- `season.drop_in_fee_cents` (drop-in Tikkie) → match against owed attendance

If neither matches exactly: leave for manual review (could be partial payment, overpayment, refund).

## Error / Retry Handling

- Bunq retries on 4xx/5xx
- Return 200 on every successful match AND every "no match" (we processed it, even if no action)
- Return 4xx only on signature failure or malformed payload (prevents retry storm on bad data)
- Idempotency: check for existing `bunq_payment_id` before inserting/updating; same payment ID → no-op

## Security Notes

- Signature verification is mandatory; reject unsigned requests
- API key stored server-only (`BUNQ_API_KEY`, never `NEXT_PUBLIC_`)
- Webhook endpoint rate-limited (Cloudflare Workers handles this scale trivially)
- Audit log entries for every webhook event (signature ok, match outcome, action taken)
- No additional PII captured beyond what we already store

## Open Questions for Implementation Time

- Does Bunq sandbox payment lifecycle differ from production?
- IP allowlist viable? Bunq's static IPs as of [date] — verify when implementing
- How are refunds notified — separate webhook event or new payment with negative amount?
- Multi-currency? EUR only for now; punt FX
- What's the SLA for webhook delivery? (Probably best-effort within minutes)

## Decision Log

- **Server-side description parsing**: chosen over admin manual entry because reconciliation time is the entire reason this phase exists. Manual entry would defeat the purpose.
- **Confidence-gated auto-confirm**: low-confidence matches stay in admin queue. Better to under-confirm than to mis-confirm.
- **Schema unchanged**: `bunq_payment_id` columns already reserved; no migration cost.
