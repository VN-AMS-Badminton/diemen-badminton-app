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
npm run db:start   # boots Postgres 17 + GoTrue + Storage + Studio (~30s first run)
npm run db:env     # writes .env.local pointing to the local stack
npm run dev        # Next.js dev server connects to http://127.0.0.1:54321
```

Studio (web UI) at <http://127.0.0.1:54323>.

When done:

```bash
npm run db:stop
```

## Useful commands

| Command | What it does |
|---|---|
| `npm run db:start` | Boot local stack and auto-apply all migrations |
| `npm run db:stop` | Stop the local stack (keeps data volumes) |
| `npm run db:reset` | Re-run migrations from scratch (wipes local data) |
| `npm run db:status` | Show URLs + keys for the running stack |
| `npm run db:studio` | Open Studio in browser |
| `npm run db:migrate:new <name>` | Scaffold a new migration file |
| `npm run db:env` | Write/refresh `.env.local` with local URLs + keys |

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

`npm run db:env` populates the Supabase trio + a freshly-generated
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
   npm run db:migrate:new my_change_name
   # Edit the new file in supabase/migrations/
   npm run db:reset   # verify it applies cleanly from scratch
   ```
3. Push to prod:
   ```bash
   supabase db push
   ```

## Troubleshooting

**`npm run db:start` hangs.** Docker isn't running. Launch Docker Desktop
and retry.

**Port conflicts (54321/54322/54323).** Another Supabase project is using
the default ports. Either stop it (`supabase stop` in that project) or
change ports in `supabase/config.toml`.

**App still hitting prod after `db:env`.** Restart the Next.js dev server —
env vars are read at process start.

**Reset everything.** `supabase stop --no-backup && npm run db:start`.
