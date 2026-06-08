# Deployment Guide

VN-AMS Badminton is a server-rendered Next.js 15 app (App Router, 27 API routes, cookie sessions, server actions, web-push) — it **cannot** be a static export. The canonical production target is **Cloudflare Workers**, compiled from the Next.js standalone output by the OpenNext adapter (`@opennextjs/cloudflare`). Fly.io and Vercel are documented as alternatives.

---

## Cloudflare Workers (canonical)

### Architecture

```
GitHub repo                Cloudflare Workers
─────────────              ──────────────────
push / local ──► cf:build (opennextjs-cloudflare build)
                       │  next build → .open-next/worker.js + assets
                       ▼
                 wrangler deploy ──► Worker (nodejs_compat)
                       │                 ├─ ASSETS binding (static files)
                       │                 ├─ IMAGES binding (image optimization)
                       │                 └─ WORKER_SELF_REFERENCE (ISR/cache)
                       ▼
                 Supabase (external Postgres + RLS)
```

- **Runtime:** Workers, `nodejs_compat` + `global_fetch_strictly_public` flags, `compatibility_date = 2026-06-05`
- **Two environments** (see `wrangler.jsonc`):
  - **prod** → worker `diemen-badminton-app-prd`, domain `vn-ams-badminton.com`, preview URLs off
  - **dev** → worker `diemen-badminton-app-dev`, domain `dev.vn-ams-badminton.com`, preview URLs on
- **Custom domains** are declared in `wrangler.jsonc` `routes`; the domain must be an active zone in the Cloudflare account
- **`NEXT_PUBLIC_*`** vars are inlined into the client bundle at **build time** → must be present in the shell running `cf:build`
- **Server secrets** are set per-env via `wrangler secret put` — never stored in `wrangler.jsonc`

### Key Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Worker config: names, domains, bindings, per-env `dev` block |
| `open-next.config.ts` | OpenNext adapter config (R2 incremental cache commented out) |
| `next.config.mjs` | `output: "standalone"` — required by OpenNext; `bcryptjs` in `serverExternalPackages` |
| `.open-next/` | Build output (gitignored) |

### Scripts

| Script | Command | Does |
|---|---|---|
| `pnpm cf:build` | `pnpm install --frozen-lockfile && opennextjs-cloudflare build` | Build Worker into `.open-next/` |
| `pnpm cf:deploy:prd` | `wrangler deploy` | Deploy to `diemen-badminton-app-prd` (top-level env, **no** `--env`) |
| `pnpm cf:deploy:dev` | `wrangler deploy --env dev` | Deploy to `diemen-badminton-app-dev` |
| `pnpm cf:version` | `wrangler versions upload` | Upload version without taking traffic (gradual rollout) |
| `pnpm cf-typegen` | `wrangler types --env-interface CloudflareEnv` | Regenerate `CloudflareEnv` types after binding changes |

> `prd` is the **top-level** config block → prod commands take **no** `--env` flag. `dev` lives under `env.dev` → dev commands need `--env dev`.

### Environment Variables

| Var | Class | How it's provided |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | shell env at `cf:build` time |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | shell env at `cf:build` time |
| `NEXT_PUBLIC_APP_URL` | public | shell env at `cf:build` time |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public | shell env at `cf:build` time |
| `SUPABASE_SECRET_KEY` | secret | `wrangler secret put` |
| `SESSION_SECRET` | secret | `wrangler secret put` |
| `TIKKIE_DEFAULT_URL` | secret | `wrangler secret put` |
| `VAPID_PRIVATE_KEY` | secret | `wrangler secret put` |
| `VAPID_SUBJECT` | secret | `wrangler secret put` |

`NEXT_PUBLIC_APP_URL` must match the env's domain (`https://vn-ams-badminton.com` for prod, `https://dev.vn-ams-badminton.com` for dev).

### One-Time Setup

#### 1. Install & authenticate

```bash
pnpm install
pnpm wrangler login        # opens browser; or set CLOUDFLARE_API_TOKEN
```

The custom domains in `wrangler.jsonc` require `vn-ams-badminton.com` to be an active zone in the target Cloudflare account.

#### 2. Set server secrets (per environment)

Run once per secret, per env. Wrangler prompts for the value (keeps it out of shell history):

```bash
# prod (top-level env, no --env)
pnpm wrangler secret put SUPABASE_SECRET_KEY
pnpm wrangler secret put SESSION_SECRET        # value: openssl rand -base64 32
pnpm wrangler secret put TIKKIE_DEFAULT_URL
pnpm wrangler secret put VAPID_PRIVATE_KEY
pnpm wrangler secret put VAPID_SUBJECT

# dev (repeat each with --env dev)
pnpm wrangler secret put SUPABASE_SECRET_KEY --env dev
# ...etc
```

List what's set: `pnpm wrangler secret list` (add `--env dev` for dev).

#### 3. First deploy

Public vars must be exported **before** building (Next.js inlines them). Example for prod:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
export NEXT_PUBLIC_APP_URL="https://vn-ams-badminton.com"
export NEXT_PUBLIC_VAPID_PUBLIC_KEY="<from: npx web-push generate-vapid-keys>"

pnpm cf:build
pnpm cf:deploy:prd
```

For dev, export `NEXT_PUBLIC_APP_URL="https://dev.vn-ams-badminton.com"`, then `pnpm cf:build && pnpm cf:deploy:dev`.

Verify:

```bash
pnpm wrangler tail                 # live logs (prod); add --env dev for dev
open https://vn-ams-badminton.com
```

### Local Preview (Workers runtime)

`pnpm dev` runs the normal Next.js dev server. To exercise the **actual Worker** locally, create a gitignored `.dev.vars` file with server secrets:

```
# .dev.vars  (gitignored — do NOT commit)
SUPABASE_SECRET_KEY=...
SESSION_SECRET=...
TIKKIE_DEFAULT_URL=https://tikkie.me/pay/...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

Then: `pnpm cf:build && pnpm wrangler dev` (public `NEXT_PUBLIC_*` still come from the build-time shell env).

### CI/CD (optional — not yet wired up)

No Cloudflare GitHub Actions workflow exists yet (`.github/workflows/` has `fly-deploy.yml` + `test.yml` only). To auto-deploy `main`:

```yaml
# .github/workflows/cloudflare-deploy.yml
name: Cloudflare Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
concurrency:
  group: cf-deploy-${{ github.ref }}
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'pnpm' }
      - run: pnpm cf:build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
          NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}
          NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${{ secrets.NEXT_PUBLIC_VAPID_PUBLIC_KEY }}
      - run: pnpm cf:deploy:prd
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Server secrets stay in Cloudflare (set via `wrangler secret put`), **not** in GitHub. Create `CLOUDFLARE_API_TOKEN` with the "Edit Workers" template.

### Day-to-Day Operations

| Task | Command |
|---|---|
| Deploy prod | `pnpm cf:build && pnpm cf:deploy:prd` |
| Deploy dev | `pnpm cf:build && pnpm cf:deploy:dev` |
| Tail logs | `pnpm wrangler tail` (`--env dev` for dev) |
| Update a secret | `pnpm wrangler secret put NAME` (`--env dev` for dev) |
| Rotate session secret | `pnpm wrangler secret put SESSION_SECRET` (logs everyone out) |
| List secrets | `pnpm wrangler secret list` |
| Regenerate env types | `pnpm cf-typegen` |
| Gradual rollout | `pnpm cf:version` then promote in Cloudflare dashboard |

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| `NEXT_PUBLIC_* is undefined` in browser | Var not exported before `cf:build`. Re-export all four and rebuild. |
| 500 + "missing secret" in `wrangler tail` | A `wrangler secret put` was skipped for that env. |
| `Node.js compatibility` build/runtime error | `nodejs_compat` missing — it's in `wrangler.jsonc` `compatibility_flags`; don't remove. |
| Custom domain 522/not resolving | `vn-ams-badminton.com` zone not in this CF account, or DNS not proxied. |
| Stale page after deploy | ISR/asset cache — confirm `WORKER_SELF_REFERENCE` service name matches the env's worker name. |
| `bcryptjs` errors at runtime | Kept in `serverExternalPackages` (`next.config.mjs`) — leave as-is. |

### Rollback

```bash
pnpm wrangler deployments list        # find a prior version id (--env dev for dev)
pnpm wrangler rollback [VERSION_ID]
```

Or revert the offending commit and redeploy.

### Cost Notes

- Workers **Paid plan ($5/mo)** is the practical baseline (image optimization + sustained CPU). The free tier (100k req/day) technically fits a 30-user club but lacks some bindings/headroom.
- Egress is free on Cloudflare. Supabase billed separately (free tier OK at this scale).

---

## Alternatives

### Fly.io

`Dockerfile` and `fly.toml` are committed (app `diemen-badminton-app`, primary region `ams`, shared-cpu-1x / 512 MB). Deploy with:

```bash
fly deploy \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="..." \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..." \
  --build-arg NEXT_PUBLIC_APP_URL="..."
```

Set runtime secrets via `fly secrets set SUPABASE_SECRET_KEY=... SESSION_SECRET=...`. See `fly.toml` for full config.

### Vercel

Zero-config Next.js host; no Vercel config file exists in the repo. Set all canonical env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `TIKKIE_DEFAULT_URL`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) in the Vercel project settings and deploy via Git integration or `vercel deploy`.
