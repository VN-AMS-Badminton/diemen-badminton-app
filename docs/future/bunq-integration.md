# Future: Bunq Webhook Auto-Reconciliation

**Status:** deferred. v1 ships with honor-system + admin spot-check. This doc captures the design so a future session can implement without re-research.

**Last reviewed:** 2026-05-13

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
2. Add `BUNQ_API_KEY`, `BUNQ_WEBHOOK_SECRET` to Vercel env vars
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
- Webhook endpoint rate-limited (Vercel edge: ~100 req/s should suffice)
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
