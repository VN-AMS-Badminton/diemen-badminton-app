# Local development

Local Supabase stack keeps dev data isolated from prod. All schema changes
are tracked in `supabase/migrations/` and applied to both local and
production from the same SQL source.

## One-time setup

1. **Docker Desktop running** (or any Docker daemon Supabase CLI can reach).
2. **Supabase CLI** ≥ 2.79 — `brew install supabase/tap/supabase`.

That's it. Migrations already live in `supabase/migrations/`, and
`supabase/config.toml` is committed.

## Daily flow

```bash
pnpm db:start   # boots Postgres 17 + GoTrue + Storage + Studio (~30s first run)
pnpm db:env     # writes .env.local pointing to the local stack
pnpm dev        # Next.js dev server connects to http://127.0.0.1:54321
```

Studio (web UI) at <http://127.0.0.1:54323>.

When done:

```bash
pnpm db:stop
```

## Useful commands

| Command | What it does |
|---|---|
| `pnpm db:start` | Boot local stack and auto-apply all migrations |
| `pnpm db:stop` | Stop the local stack (keeps data volumes) |
| `pnpm db:reset` | Re-run migrations from scratch (wipes local data) |
| `pnpm db:status` | Show URLs + keys for the running stack |
| `pnpm db:studio` | Open Studio in browser |
| `pnpm db:migrate:new <name>` | Scaffold a new migration file |
| `pnpm db:env` | Write/refresh `.env.local` with local URLs + keys |

## Environment variables

`.env.local` (auto-generated, gitignored) holds:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local: `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon JWT printed by `supabase status` |
| `SUPABASE_SECRET_KEY` | Service-role JWT (server-only) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for referral links |
| `SESSION_SECRET` | 32+ byte random secret for session JWT signing |
| `TIKKIE_DEFAULT_URL` | Fallback pay link for sessions without an override |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key (generated via `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Web Push private key (server-only) |
| `VAPID_SUBJECT` | Mailto address for Web Push, e.g., `mailto:admin@diemen.nl` |

`pnpm db:env` populates the Supabase trio + a freshly-generated
`SESSION_SECRET` automatically. Tikkie URL and APP_URL get sensible
defaults — override them if needed.

Generate VAPID keys for Web Push:
```bash
npx web-push generate-vapid-keys
```
Copy both keys and the subject email into `.env.local`.

## Production env vars

Set the same variable names in your hosting provider (Vercel/etc.). The
production `NEXT_PUBLIC_SUPABASE_URL` and keys come from the Supabase
dashboard for the linked project (`supabase/.temp/project-ref` records
which one). Never commit prod keys.

## Making schema changes

1. Iterate on local with raw SQL via Studio or `psql`:
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
2. When the change is final, capture it as a migration:
   ```bash
   pnpm db:migrate:new my_change_name
   # Edit the new file in supabase/migrations/
   pnpm db:reset   # verify it applies cleanly from scratch
   ```
3. Push to prod:
   ```bash
   supabase db push
   ```

## Troubleshooting

**`pnpm db:start` hangs.** Docker isn't running. Launch Docker Desktop
and retry.

**Port conflicts (54321/54322/54323).** Another Supabase project is using
the default ports. Either stop it (`supabase stop` in that project) or
change ports in `supabase/config.toml`.

**App still hitting prod after `db:env`.** Restart the Next.js dev server —
env vars are read at process start.

**Reset everything.** `supabase stop --no-backup && pnpm db:start`.
