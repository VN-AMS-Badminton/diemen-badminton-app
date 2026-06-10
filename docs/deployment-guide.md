# Deployment Guide — Cloudflare Workers

Production deployment of Diemen Badminton on **Cloudflare Workers** via OpenNext
(`@opennextjs/cloudflare`). Supabase is the external database. The live app is
served from Cloudflare Workers (`wrangler.jsonc` + the `cf-ray` / `server: cloudflare`
response headers on `vn-ams-badminton.com`).

## Architecture

```
GitHub repo ──push──► build ──► opennextjs-cloudflare build ──► .open-next/worker.js
                                                                      │
                                                                      ▼
                                            Worker (workerd, nodejs_compat)
                                            ├─ prd: diemen-badminton-app-prd
                                            │       └─ vn-ams-badminton.com
                                            └─ dev: diemen-badminton-app-dev
                                                    └─ dev.vn-ams-badminton.com
                                                                      │
                                                                      └─► Supabase (external)
```

- **Runtime:** Cloudflare Workers (`workerd`) with `nodejs_compat`; see `wrangler.jsonc`.
- **Build:** OpenNext adapter transforms the Next.js build into a Worker bundle
  (`.open-next/worker.js`).
- **Environments:** two named Workers — `prd` and `dev` — each with its own custom
  domain. Deploys always target an env (`--env prd` / `--env dev`).
- **Runtime env:** Worker vars/secrets (server-only), set per environment.
  `NEXT_PUBLIC_*` are inlined into the client bundle **at build time**.
- **Cost:** Workers free tier (100k requests/day) covers a 30–50 player club with
  room to spare — effectively free.

## Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Worker config: `prd`/`dev` envs, custom domain routes, `nodejs_compat`, bindings |
| `open-next.config.ts` | OpenNext Cloudflare adapter config |
| `next.config.mjs` | Next.js config |
| `.github/workflows/test.yml` | CI tests |

## Deploy

```bash
pnpm cf:build          # pnpm install --frozen-lockfile && opennextjs-cloudflare build
pnpm cf:deploy:prd     # wrangler deploy --env prd  → vn-ams-badminton.com
pnpm cf:deploy:dev     # wrangler deploy --env dev  → dev.vn-ams-badminton.com
```

For a local preview on `workerd` (closest to prod), build then run
`npx wrangler dev --env dev`. `pnpm dev` (plain `next dev`) is fine for day-to-day
app work.

## One-Time Setup

### 1. Supabase

Create the project and run the migrations in `supabase/migrations/` in order
(SQL editor or `supabase db push`). Apply **new** migrations to every
environment's DB before deploying code that depends on them.

### 2. Runtime env (Worker vars/secrets)

Set per environment via the Cloudflare dashboard (**Workers & Pages → the Worker →
Settings → Variables and Secrets**) or `wrangler`:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY --env prd
npx wrangler secret put SESSION_SECRET      --env prd   # openssl rand -base64 32
npx wrangler secret put TIKKIE_DEFAULT_URL  --env prd
# repeat with --env dev for the staging Worker
```

Each named env (`prd`, `dev`) is a separate Worker with its own secrets, so
staging and production never share runtime config.

### 3. Build-time env (`NEXT_PUBLIC_*`)

These are inlined into the client bundle at build time, so they must be present in
the **build** environment (your shell for a manual `pnpm cf:build`, or the build
settings if using Cloudflare Workers Builds):

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `NEXT_PUBLIC_APP_URL` | `https://vn-ams-badminton.com` (prod) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | from `npx web-push generate-vapid-keys` |

(Full list of names in `env.example.txt`.)

### 4. Domains

- **Production:** `vn-ams-badminton.com` (custom domain route on the `prd` env).
- **Staging:** `dev.vn-ams-badminton.com` (custom domain route on the `dev` env).

## Day-to-Day Operations

| Task | Command / Where |
|---|---|
| Deploy prod | `pnpm cf:deploy:prd` |
| Deploy staging | `pnpm cf:deploy:dev` |
| Tail logs | `npx wrangler tail --env prd` (or dashboard → Workers → Logs) |
| Set/rotate a secret | `npx wrangler secret put NAME --env prd` or dashboard |
| Rotate session secret | `npx wrangler secret put SESSION_SECRET --env prd` (logs everyone out) |
| List deployments | `npx wrangler deployments list --env prd` |
| Rollback | `npx wrangler rollback --env prd [--version-id <id>]`, or revert the commit |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `NEXT_PUBLIC_… is not defined` in browser | Build-time var missing in the build env. Rebuild with it set. |
| Runtime `process.env.X` undefined | Server var/secret not set on that env's Worker (vars/secrets ≠ build env). |
| `node:crypto` error on workerd | Use Web Crypto in runtime code; `node:crypto` is for local scripts only. |
| Wrong env deployed | Confirm the `--env prd` / `--env dev` flag — there is no default target Worker. |

## Unresolved questions

- Confirm whether deploys run manually (`pnpm cf:deploy:*`) or via Cloudflare
  Workers Builds (dashboard git integration) — determines where build-time
  `NEXT_PUBLIC_*` are configured.
