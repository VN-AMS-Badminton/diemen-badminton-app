# Diemen Badminton App

Mobile-friendly web app for managing a 30+ player Dutch badminton club.

- Monthly subscription poll
- Weekly RSVP (subscribers opt out, drop-ins opt in)
- Honor-system payment tracking via personal Tikkie

Stack: Next.js 15 (App Router, TS) + Supabase (Postgres + RLS) + Tailwind + shadcn/ui + Vercel.

## Local Development

### 1. Install Node 24+

```bash
nvm use
corepack enable           # one-time: pins pnpm via packageManager field
pnpm install
```

### 2. Create a Supabase project

1. https://supabase.com/dashboard → New project (free tier OK)
2. Copy these from Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configure environment variables

Copy `env.example.txt` to `.env.local` (gitignored) and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=<openssl rand -base64 32>
TIKKIE_DEFAULT_URL=https://tikkie.me/pay/<your-personal-link>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For push notifications, generate a VAPID keypair and add to `.env.local`:

```bash
npx web-push generate-vapid-keys
```

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key from above>
VAPID_PRIVATE_KEY=<private key from above>
VAPID_SUBJECT=mailto:<your-email>
```

### 4. Apply database migrations

Run these SQL files in order in the Supabase SQL editor (or via `supabase db push`):

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0003_rls_policies.sql`
3. Generate an admin PIN hash:
   ```bash
   pnpm hash-pin -- 123456
   ```
   Copy the hash output into `supabase/migrations/0002_seed_admin.sql` and customize the admin username + WhatsApp number, then run that migration.

### 5. Run dev server

```bash
pnpm dev
```

Open http://localhost:3000.

## Production Deployment

- Push to GitHub
- Connect repo to Vercel
- Set all env vars from `.env.local` in Vercel project settings
- Deploy

See `docs/soft-launch-playbook.md` for rollout strategy.

## Project Structure

```
src/
├── app/                # Next.js App Router pages, server actions, API routes
├── components/         # React components (ui/, auth/, player/, admin/)
└── lib/                # Server utilities (auth, db, sessions, supabase, payments)

supabase/migrations/    # Versioned SQL migrations
scripts/                # One-off helpers (hash-pin)
docs/                   # Architecture, deployment, future work
```

## Roadmap

- v1 (current): manual Tikkie + honor-system payment tracking
- Future: Bunq webhook auto-confirmation — see `docs/future-bunq-integration.md`
