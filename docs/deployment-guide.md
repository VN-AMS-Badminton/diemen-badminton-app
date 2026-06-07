# Deployment Guide — Fly.io

Production deployment of Diemen Badminton on Fly.io with Docker + GitHub Actions CI/CD.

## Architecture

```
GitHub repo                  Fly.io (region: ams)
─────────────                ─────────────────────
push to main ──► Actions ──► fly deploy --remote-only
                                │
                                ▼
                          Docker build (Node 22)
                                │
                                ▼
                          1× shared-cpu-1x, 512MB
                          auto-stop when idle
                                │
                                └─► Supabase (external)
```

- **Region:** Amsterdam (`ams`) — ~5ms latency for Diemen members
- **VM:** shared-cpu-1x / 512MB / scale-to-zero
- **Build:** remote (Fly builders), no local Docker needed for CI
- **Runtime env:** Fly secrets (server-only); `NEXT_PUBLIC_*` baked at build time
- **Expected cost:** $1–4/mo (Fly waives bills under $5)

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build, Node 22 LTS, Next.js standalone, non-root user |
| `.dockerignore` | Excludes secrets, build artifacts, docs, `.claude` tooling |
| `fly.toml` | App config (region, VM size, healthcheck, autoscale) |
| `next.config.mjs` | `output: "standalone"` enables the lean runtime image |
| `.github/workflows/fly-deploy.yml` | Auto-deploys `main` to Fly |

## One-Time Setup

### 1. Install flyctl

```bash
brew install flyctl   # macOS
# or: curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Create the Fly app

From the repo root:

```bash
fly apps create diemen-badminton --org personal
```

If `diemen-badminton` is taken, pick another name and **update `app = "..."` in `fly.toml` to match**.

### 3. Set runtime secrets

These are injected at runtime, never baked into the image:

```bash
fly secrets set \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  SESSION_SECRET="$(openssl rand -base64 32)" \
  PAYMENT_PROVIDER="tikkie" \
  TIKKIE_DEFAULT_URL="https://tikkie.me/pay/your-link" \
  BUNQ_DEFAULT_URL="https://bunq.me/your-link"
```

`PAYMENT_PROVIDER` selects the active provider (`tikkie` | `bunq`). Keep it
`tikkie` until bunq is verified, then flip — see "bunq payment rollout" below.
The `BUNQ_WEBHOOK_SECRET` / `BUNQ_SERVER_PUBLIC_KEY` secrets are added during
that rollout, not at first deploy.

### 4. First deploy (manual, sets the baseline)

`NEXT_PUBLIC_*` vars are inlined into the client bundle at build time → must be passed as `--build-arg`:

```bash
fly deploy \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." \
  --build-arg NEXT_PUBLIC_APP_URL="https://diemen-badminton.fly.dev" \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="<public key from web-push generate-vapid-keys>"
```

Wait for the build to finish, then verify:

```bash
fly status
fly logs
open https://diemen-badminton.fly.dev
```

### 5. Wire up GitHub Actions auto-deploy

Generate a deploy token (non-expiring is OK for a personal project; rotate yearly):

```bash
fly tokens create deploy -x 999999h
```

Copy the output, then in **GitHub → repo → Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret name | Value |
|---|---|
| `FLY_API_TOKEN` | the token printed above |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | `https://diemen-badminton.fly.dev` (or custom domain) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public key from `npx web-push generate-vapid-keys` |

Push to `main` → GitHub Actions deploys automatically.

### 6. (Optional) Custom domain

```bash
fly certs add diemen.example.nl
# follow the DNS instructions Fly prints (A + AAAA records)
fly secrets set NEXT_PUBLIC_APP_URL=https://diemen.example.nl  # runtime override
# and re-deploy so the value gets re-baked into the client bundle:
fly deploy --build-arg NEXT_PUBLIC_APP_URL=https://diemen.example.nl ...
```

Also update the `NEXT_PUBLIC_APP_URL` GitHub secret so future CI deploys use the new domain.

## Day-to-Day Operations

| Task | Command |
|---|---|
| Manual deploy from local | `fly deploy --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... --build-arg NEXT_PUBLIC_APP_URL=... --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=...` |
| Tail logs | `fly logs` |
| SSH into running VM | `fly ssh console` |
| Restart | `fly machine restart` |
| Rotate session secret | `fly secrets set SESSION_SECRET=$(openssl rand -base64 32)` (auto-rollout, logs everyone out) |
| Scale up | `fly scale memory 1024` (RAM) or `fly scale vm shared-cpu-2x` |
| Force always-on | Set `min_machines_running = 1` in `fly.toml`, redeploy |
| Cost dashboard | `fly orgs show personal` or https://fly.io/dashboard/personal/billing |

## bunq Payment Rollout

> **Deploy target:** this app runs on **Cloudflare Workers** (OpenNext) — see
> `wrangler.jsonc` (custom domain `vn-ams-badminton.com`, `nodejs_compat`). The
> Fly.io instructions elsewhere in this guide are stale; runtime env for bunq is
> set as Worker vars/secrets via `wrangler` or the Cloudflare dashboard. The
> webhook signature check uses Web Crypto so it runs natively on workerd.

bunq auto-reconciliation runs in parallel with Tikkie behind `PAYMENT_PROVIDER`.
Rollback is a single var flip. The runtime never opens a bunq session — it only
RECEIVES callbacks — so the auth handshake happens once, locally.

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
3. **Set Worker secrets** (or use the Cloudflare dashboard → Workers → Settings →
   Variables; mark as encrypted):
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

## Cost Notes

- 1× shared-cpu-1x/512MB always-on: **~$3.20/mo**
- With `auto_stop_machines = "stop"` and a 30-user club: **~$0.50–2/mo** computed
- **Fly waives any monthly bill under $5** — so this app is effectively free
- First 100GB egress free in NA/EU (you'll use <2GB/mo)

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login takes 10+ seconds | Cold start after auto-stop — normal, ~300ms once warm. Bump `min_machines_running = 1` to eliminate. |
| `Error: NEXT_PUBLIC_SUPABASE_URL is not defined` in browser | Missed a `--build-arg`. Re-deploy with all three NEXT_PUBLIC args. |
| Healthcheck failing | App boots slower than `grace_period = "10s"`. Increase it in `fly.toml`. |
| Build OOM | Bump build memory: `fly deploy --build-target=builder --vm-memory=2048` (one-off) |
| "App not found" in CI | `FLY_API_TOKEN` is wrong scope. Regenerate with `fly tokens create deploy`. |

## Rollback

```bash
fly releases                       # list versions
fly deploy --image registry.fly.io/diemen-badminton:deployment-XYZ
```

Or revert the offending commit on `main` — CI redeploys automatically.

## Unresolved questions

- Run scale-to-zero or always-on by default? Auto-stop is cheaper; always-on adds ~$2/mo but kills cold-start latency for the Thursday-evening RSVP burst.
- Custom domain or stick with `*.fly.dev` for soft launch? `.fly.dev` works fine, just less branded.
- Add a staging app (`diemen-badminton-staging`) on a `develop` branch, or YAGNI for a 30-person club?
