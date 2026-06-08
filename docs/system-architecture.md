# System Architecture

VN-AMS Badminton — a Next.js 15 web app for a Dutch badminton club, running on Cloudflare Workers.

---

## Runtime

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Build adapter | OpenNext — compiles `output: "standalone"` into a single Cloudflare Worker |
| Edge runtime | Cloudflare Workers with `nodejs_compat` + `global_fetch_strictly_public` flags |
| Static assets | Served from `.open-next/assets` via the `ASSETS` binding |

`next.config.mjs` sets `output: "standalone"` and marks `bcryptjs` as a server-external package so the native binding resolves correctly inside the Worker.

---

## Request flow

```
Browser
  │
  ▼
Cloudflare Worker (OpenNext entry: .open-next/worker.js)
  │
  ├─ Static assets → ASSETS binding (JS/CSS/images)
  │
  └─ Dynamic requests
       │
       ▼
     src/middleware.ts          ← JWT verification + RBAC gate
       │
       ├─ Public paths → pass through
       ├─ Unauthenticated → redirect /
       ├─ /admin + non-admin role → redirect /forbidden
       └─ Authenticated → set x-player-id / x-player-role headers, continue
            │
            ├─ RSC page components  (server components read cookies directly)
            ├─ 27 API route handlers  src/app/api/**/route.ts
            └─ Server actions         src/lib/notifications/subscribe-actions.ts
```

**Public paths** (no session required): `/`, `/register`, `/forbidden`, `/refer/<code>`, and the auth/refer API endpoints.

---

## Auth & sessions

- **Registration / login**: PIN entered by the player is hashed with `bcryptjs` (cost 10) via `src/lib/auth/pin.ts`. Hash stored in the `players` table.
- **Session token**: On successful login, a `jose`-signed JWT (`HS256`) is issued (`src/lib/auth/session.ts`) and stored in a `session` HTTP cookie.
- **Session reads**: `src/lib/auth/get-session.ts` calls `next/headers` `cookies()` — server-side only. Exports `getOptionalSession`, `requireSession`, `requireAdmin`.
- **Middleware enforcement**: `src/middleware.ts` calls `verifySession` on every non-public, non-static request; forwards `x-player-id` / `x-player-role` headers to RSCs.
- **Invite flow**: `src/lib/auth/invite.ts` validates one-time invite tokens before registration.
- **Rate limiting**: `src/lib/auth/rate-limit.ts` — in-memory per-username limiter on login attempts.

---

## Data layer

- **Database**: Supabase Postgres.
- **Server client** (`src/lib/supabase/server.ts`): uses `SUPABASE_SECRET_KEY` (service role). Imported only in server components, API routes, and server actions — never in client components.
- **Browser client** (`src/lib/supabase/client.ts`): uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. RLS policies are deny-all, so the browser client cannot read or write any table directly; all mutations go through API routes.
- **Types**: `src/lib/db/types.ts` — hand-written TypeScript types mirroring the schema (enums, row shapes). Payment status values: `assumed_paid` | `flagged` | `unpaid`.
- **RPC**: `resolve_session_cutoff` — lazy Postgres function that computes booking cutoff times; called server-side during session queries.

See [database-schema.md](./database-schema.md) for full table and migration details.

---

## Module map

| Module | Responsibility |
|---|---|
| `src/lib/admin/audit.ts` | Writes audit log entries for admin actions |
| `src/lib/auth/get-session.ts` | Server-side session helpers (`requireSession`, `requireAdmin`) |
| `src/lib/auth/invite.ts` | Validates one-time invite tokens for registration |
| `src/lib/auth/pin.ts` | bcryptjs PIN hashing and verification |
| `src/lib/auth/rate-limit.ts` | In-memory login rate limiter keyed by username |
| `src/lib/auth/session.ts` | jose JWT sign/verify; defines `SESSION_COOKIE_NAME` and `SessionPayload` |
| `src/lib/db/types.ts` | Shared TypeScript types for all DB row shapes and enums |
| `src/lib/notifications/push-payload.ts` | Constructs web-push notification payloads |
| `src/lib/notifications/send-push.ts` | Sends web-push messages via the `web-push` library |
| `src/lib/notifications/subscribe-actions.ts` | Server action: save/remove push subscriptions |
| `src/lib/notifications/vapid-public-key.ts` | Exposes the VAPID public key to the browser |
| `src/lib/referrals/` | Referral slot lifecycle: activate, cancel, list, refund, count consumed slots |
| `src/lib/seasons/cascade-season-edit.ts` | Propagates season edits to generated sessions |
| `src/lib/seasons/enumerate-weekday-dates.ts` | Generates recurring weekday dates for a season |
| `src/lib/seasons/generate-sessions-for-season.ts` | Bulk-creates sessions from a season definition |
| `src/lib/seasons/get-active-poll.ts` | Fetches the active availability poll for a season |
| `src/lib/seasons/list-season-subscribers.ts` | Lists players subscribed to a season |
| `src/lib/sessions/capacity.ts` | Queries remaining slot capacity for a session |
| `src/lib/sessions/get-next-session.ts` | Fetches the next upcoming session |
| `src/lib/sessions/get-payment-context.ts` | Assembles payment status context for a player/session |
| `src/lib/sessions/pass-slot.ts` | Transfers a permanent slot between players |
| `src/lib/sessions/payment-deadline.ts` | Computes payment deadline for a session |
| `src/lib/sessions/resolve-cutoff.ts` | Calls `resolve_session_cutoff` RPC |
| `src/lib/sessions/resolve-payment-deadlines.ts` | Bulk-resolves payment deadlines across sessions |
| `src/lib/supabase/client.ts` | Browser-side Supabase client (publishable key) |
| `src/lib/supabase/server.ts` | Server-side Supabase client (secret key, service role) |
| `src/lib/waitlist/get-waitlist-position.ts` | Returns a player's position in the session waitlist |
| `src/lib/waitlist/join-waitlist.ts` | Adds a player to the waitlist |
| `src/lib/waitlist/promote-waitlist.ts` | Promotes the next waitlist player when a slot opens |
| `src/lib/amsterdam-time-utils.ts` | Amsterdam (Europe/Amsterdam) timezone conversion helpers |
| `src/lib/format.ts` | Locale-aware date/number formatters for Amsterdam display |
| `src/lib/utils.ts` | Tailwind class merging utility (`cn`) |

---

## Notifications

Web-push notifications are delivered via the [Web Push Protocol](https://www.rfc-editor.org/rfc/rfc8030):

- **VAPID keys**: `VAPID_PRIVATE_KEY` held server-side; public key exposed to the browser via `src/lib/notifications/vapid-public-key.ts`.
- **Subscription storage**: browser calls the server action in `src/lib/notifications/subscribe-actions.ts` to persist or remove a `PushSubscription`.
- **Sending**: `src/lib/notifications/send-push.ts` uses the `web-push` npm package; called from API routes when session events occur.
- **Service worker** (`/sw.js`): served with `no-cache` headers so updates propagate immediately; handles `push` events client-side.

---

## Deployment runtime

Cloudflare Worker bindings declared in `wrangler.jsonc`:

| Binding | Type | Purpose |
|---|---|---|
| `ASSETS` | Asset binding | Serves `.open-next/assets` (static files) |
| `IMAGES` | Images binding | Cloudflare Images transformation |
| `WORKER_SELF_REFERENCE` | Service binding | Worker self-calls for OpenNext ISR/caching |

Two named environments:

| Environment | Worker name | Domain |
|---|---|---|
| Production (`prd`) | `diemen-badminton-app-prd` | `vn-ams-badminton.com` |
| Development (`dev`) | `diemen-badminton-app-dev` | `dev.vn-ams-badminton.com` |

See [deployment-guide.md](./deployment-guide.md) for CI/CD pipeline and secrets configuration.
