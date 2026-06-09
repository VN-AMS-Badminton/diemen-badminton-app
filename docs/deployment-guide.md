# Deployment Guide — Cloudflare Workers

Production deployment of Diemen Badminton on **Cloudflare Workers** via OpenNext
(`@opennextjs/cloudflare`). Supabase is the external database.

> **Legacy note:** `fly.toml`, `Dockerfile`, and `.github/workflows/fly-deploy.yml`
> are leftovers from a previous Fly.io setup and are **no longer the deploy target**.
> Likewise, older docs mentioning Vercel are stale. The live app is Cloudflare
> Workers (proven by `wrangler.jsonc` + the `cf-ray`/`server: cloudflare` response
> headers on `vn-ams-badminton.com`). See "Legacy cleanup" at the end.

## Architecture

```
GitHub repo ──push──► Cloudflare Workers Builds ──► opennextjs-cloudflare build
                                                         │
                                                         ▼
                                              Worker: diemen-badminton-app
                                              (workerd, nodejs_compat)
                                                 │            │
                          custom domain ─────────┘            └──── preview URLs
                          vn-ams-badminton.com                      <branch>-diemen-
                          (prod)                                    badminton-app.
                          dev.vn-ams-badminton.com (staging)        <acct>.workers.dev
                                                 │
                                                 └─► Supabase (external)
```

- **Runtime:** Cloudflare Workers (`workerd`) with `nodejs_compat`; see `wrangler.jsonc`.
- **Build:** OpenNext adapter transforms the Next.js build into a Worker bundle
  (`.open-next/worker.js`).
- **Runtime env:** Worker vars/secrets (server-only). `NEXT_PUBLIC_*` are inlined
  into the client bundle **at build time**.
- **Cost:** Workers free tier (100k requests/day) covers a 30–50 player club with
  room to spare — effectively free.

## Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Worker config: name, custom domain route, `nodejs_compat`, preview URLs, bindings |
| `open-next.config.ts` | OpenNext Cloudflare adapter config |
| `next.config.mjs` | Next.js config |
| `.github/workflows/test.yml` | CI tests |

## Deploy mechanism

Branch pushes produce per-branch **preview URLs** (`preview_urls: true`) and
pushes to the production branch update the custom domain — this is **Cloudflare
Workers Builds** (the git integration is configured in the Cloudflare dashboard,
not in a repo workflow, which is why there is no `wrangler deploy` step in CI).

**Manual deploy / preview from local** (fallback, or when Workers Builds is not
used):

```bash
# Build + deploy to the Worker (production)
npx opennextjs-cloudflare build
npx wrangler deploy

# Local preview of the built Worker (workerd, closest to prod)
npx opennextjs-cloudflare build && npx wrangler dev
```

`pnpm dev` (plain `next dev`) is fine for day-to-day app work; use the Worker
preview when you need to validate runtime behavior on `workerd` specifically
(e.g. the bunq webhook crypto path).

## One-Time Setup

### 1. Supabase

Create the project and run the migrations in `supabase/migrations/` in order
(SQL editor or `supabase db push`). Apply **new** migrations (e.g. `0024_*`) to
every environment's DB before deploying code that depends on them.

### 2. Runtime env (Worker vars/secrets)

Set via the Cloudflare dashboard (**Workers & Pages → `diemen-badminton-app` →
Settings → Variables and Secrets**) or `wrangler`:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put SESSION_SECRET          # openssl rand -base64 32
npx wrangler secret put PAYMENT_PROVIDER         # "tikkie" (default) | "bunq"
npx wrangler secret put TIKKIE_DEFAULT_URL
# bunq secrets are added during the bunq rollout (below), not at first deploy.
```

> **One Worker, shared secrets:** `wrangler.jsonc` defines a single Worker with no
> `env.*` blocks, so secrets are shared by the production deployment AND all
> preview URLs. You cannot scope a secret to only a preview with this config; to
> test a preview without affecting prod, rely on the fact that prod serves the
> last *deployed* version (a preview-only code path won't run in prod).

### 3. Build-time env (`NEXT_PUBLIC_*`)

These are inlined into the client bundle at build time, so they must be present
in the **build** environment (Workers Builds → build settings, or your shell for
a manual `opennextjs-cloudflare build`):

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `NEXT_PUBLIC_APP_URL` | `https://vn-ams-badminton.com` (prod) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | from `npx web-push generate-vapid-keys` |

(Full list of names in `env.example.txt`.)

### 4. Domains

- **Production:** `vn-ams-badminton.com` (custom domain route in `wrangler.jsonc`).
- **Staging:** `dev.vn-ams-badminton.com`.
- **Per-branch previews:** `https://<branch>-diemen-badminton-app.<account>.workers.dev`.

## Day-to-Day Operations

| Task | Command / Where |
|---|---|
| Deploy (manual) | `npx opennextjs-cloudflare build && npx wrangler deploy` |
| Tail logs | `npx wrangler tail` (or dashboard → Workers → Logs; observability is on) |
| Set/rotate a secret | `npx wrangler secret put NAME` or dashboard |
| Rotate session secret | `npx wrangler secret put SESSION_SECRET` (logs everyone out) |
| List deployments | `npx wrangler deployments list` |
| Rollback | `npx wrangler rollback [--version-id <id>]`, or revert the commit |

## bunq Payment Rollout

bunq auto-reconciliation runs in parallel with Tikkie behind `PAYMENT_PROVIDER`.
Rollback is a single var flip. The runtime never opens a bunq session — it only
RECEIVES callbacks — so the auth handshake happens once, locally, and the Worker
verifies callbacks with Web Crypto.

Sequence (after sandbox verification — see `docs/future-bunq-integration.md`):

1. **Deploy this branch** to the target environment and **apply migration 0024**
   to that environment's Supabase DB. Confirm the route is reachable (not behind
   the login gate): `curl -i -X POST https://vn-ams-badminton.com/api/webhooks/bunq/bogus -d '{}'`
   should return **401**, not a `307 → /?next=`.
2. **Register the production callback (local, one-off):**
   ```bash
   BUNQ_API_KEY=<personal-api-key> pnpm bunq:setup --production \
     --register-callback --webhook-url https://vn-ams-badminton.com
   ```
   Copy the printed `BUNQ_WEBHOOK_SECRET` and `BUNQ_SERVER_PUBLIC_KEY` (base64).
3. **Set Worker secrets** (dashboard → Variables and Secrets, or):
   ```bash
   npx wrangler secret put BUNQ_WEBHOOK_SECRET      # paste printed value
   npx wrangler secret put BUNQ_SERVER_PUBLIC_KEY   # paste printed base64
   npx wrangler secret put BUNQ_DEFAULT_URL         # https://bunq.me/your-link
   ```
4. **Flip the provider:** `npx wrangler secret put PAYMENT_PROVIDER` → `bunq`
   (or set it as a `vars` entry in `wrangler.jsonc` and redeploy).
5. **Smoke test:** make a small real payment with your name in the description →
   confirm the reconciliation page shows `paid via bunq` + an `audit_log` row.
6. **Monitor** first 2 weeks; admin keeps the manual spot-check. Then relax cadence.

**Cloudflare gotcha:** if Bot Fight Mode / WAF / "Under Attack" mode is on, add a
WAF skip rule for path `/api/webhooks/*` so bunq's server-to-server POST isn't
challenged.

**Rollback:** set `PAYMENT_PROVIDER=tikkie`. Keep the Tikkie link valid during
the monitoring window. `BUNQ_API_KEY` is NEVER set on the Worker — it is only
used by the local setup script.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `NEXT_PUBLIC_… is not defined` in browser | Build-time var missing in the Workers Builds build env. Rebuild with it set. |
| Runtime `process.env.X` undefined | Server var/secret not set on the Worker (vars/secrets ≠ build env). |
| Webhook returns `307 → /?next=` | Build predates the `/api/webhooks` middleware allowlist — redeploy. |
| Webhook returns Cloudflare challenge page | WAF / Bot Fight Mode challenging bunq's POST — add a skip rule for `/api/webhooks/*`. |
| `node:crypto` error on workerd | Use Web Crypto in runtime code (the bunq verifier already does); `node:crypto` is for local scripts only. |

## Legacy cleanup (recommended)

The Fly.io setup is dead but its files remain and may still run:

- `.github/workflows/fly-deploy.yml` — if it still triggers on push to `main`, it
  deploys to a Fly app that is no longer the live target (wasteful / confusing).
  Disable or delete it.
- `fly.toml`, `Dockerfile`, `.dockerignore` — remove once the workflow is gone.

Left in place pending confirmation — see Unresolved questions.

## Unresolved questions

- Confirm the deploy is **Cloudflare Workers Builds** (dashboard git integration)
  vs a manual/`wrangler` flow — determines whether build-time `NEXT_PUBLIC_*` live
  in the dashboard build settings or a CI workflow.
- OK to delete the Fly artifacts (`fly.toml`, `Dockerfile`, `fly-deploy.yml`)?
- Is `dev.vn-ams-badminton.com` a separate Worker/environment or the same Worker?
  (Affects whether staging can have its own bunq secrets.)
