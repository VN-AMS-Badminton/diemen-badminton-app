# VN-AMS Badminton

Mobile-friendly web app for a 30+ player Dutch (Diemen/Amsterdam) badminton club. Each month, active players fill in a subscription poll to declare participation for the upcoming season; each week, subscribers are automatically opted in and can opt out, while drop-ins must explicitly opt in. Payments are handled honor-system style via a personal Tikkie link, and the app tracks who has paid without automating bank reconciliation.

## Stack

- Next.js 15 (App Router, TypeScript)
- Supabase (Postgres + RLS)
- Tailwind CSS + shadcn/ui
- OpenNext → Cloudflare Workers
- pnpm

## Quickstart

**Prerequisites:** Node `^22 || >=24`, `corepack enable` (one-time), Docker (for local Supabase).

```bash
pnpm install

# Start local Supabase and write .env.local
pnpm db:start
pnpm db:env

# Start dev server
pnpm dev
```

Open http://localhost:3000.

Detailed local setup: [docs/local-development.md](./docs/local-development.md).

## Environment

Copy `env.example.txt` to `.env.local` (gitignored). `pnpm db:env` populates the Supabase values automatically for local development.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (public) |
| `SUPABASE_SECRET_KEY` | Supabase service-role secret (server only) |
| `SESSION_SECRET` | Secret used to sign session cookies (`openssl rand -base64 32`) |
| `TIKKIE_DEFAULT_URL` | Personal Tikkie payment link shown to players |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for Web Push notifications |
| `VAPID_PRIVATE_KEY` | VAPID private key for Web Push notifications |
| `VAPID_SUBJECT` | VAPID contact (`mailto:admin@example.com`) |

Generate VAPID keys with: `npx web-push generate-vapid-keys`

## Database

Apply all migrations in `supabase/migrations/` (e.g. `supabase db push`).

## Deployment

Deployed to Cloudflare Workers via OpenNext; see [docs/deployment-guide.md](./docs/deployment-guide.md).

## Docs

- [Project overview](./docs/project-overview.md)
- [System architecture](./docs/system-architecture.md)
- [Database schema](./docs/database-schema.md)
- [Design guidelines](./docs/design-guidelines.md)
- [Local development](./docs/local-development.md)
- [Deployment guide](./docs/deployment-guide.md)
- [Code standards](./docs/code-standards.md)
- [Project roadmap](./docs/project-roadmap.md)
- [Soft launch playbook](./docs/soft-launch-playbook.md)
- [Future: Bunq integration](./docs/future/bunq-integration.md)
- [Future: Refactor write-audit injectable Supabase](./docs/future/refactor-write-audit-injectable-sb.md)
