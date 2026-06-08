# Documentation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every doc in the repo (`docs/`, `README.md`, `env.example.txt`, `CLAUDE.md`) to be accurate, consistently structured (Approach B), and tightly written.

**Architecture:** Restructure `docs/` into a prescribed core + retained standalone docs + a `future/` folder; fix cross-cutting drift (app name, deploy target, migrations, env vars, enums); trim `CLAUDE.md` to match repo reality.

**Tech Stack (subject matter):** Next.js 15 (App Router, TS) · Supabase (Postgres + deny-all RLS) · Tailwind + shadcn/ui · jose · bcryptjs · web-push · OpenNext → Cloudflare Workers · pnpm.

**Spec:** `docs/superpowers/specs/2026-06-08-documentation-overhaul-design.md`

---

## Repo policy notes (READ FIRST)

- **Commits require explicit user approval** (`CLAUDE.md`: never commit unless asked). Each task ends with a commit step; the executor MUST ask the user before running it. Group commits per task.
- **Commit-message rule:** do NOT use `chore`/`docs` types for changes inside a `.claude` directory. (Moot here — no `.claude/` exists — but honor it if that changes.)
- **Use dedicated tools** (Read/Edit/Write), not `cat`/`sed`, when editing.

## Canonical facts (use verbatim; do not rediscover)

- **App name:** `VN-AMS Badminton`. Forbidden: `Smash Pro`.
- **Deploy default:** Cloudflare Workers (domain `vn-ams-badminton.com`). Fly.io + Vercel only under an "Alternatives" heading.
- **Migrations head:** `0023`. Never hand-list ranges; point to `supabase/migrations/`.
- **Canonical env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `TIKKIE_DEFAULT_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Forbidden: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Payment enums:** `assumed_paid`, `flagged`, `unpaid`. Forbidden: `subscriptions` table, `owed`, `self_marked_paid`, `admin_confirmed`.
- **Engines:** Node `^22 || >=24`; pnpm (pinned `pnpm@10`).
- **`src/lib` modules:** `admin/`, `auth/`, `db/`, `notifications/`, `referrals/`, `seasons/`, `sessions/`, `supabase/`, `waitlist/`, + `amsterdam-time-utils.ts`, `format.ts`, `utils.ts`. Plus `src/middleware.ts`, 27 routes under `src/app/api/`.
- **Cloudflare bindings:** `ASSETS`, `IMAGES`, `WORKER_SELF_REFERENCE`; envs `diemen-badminton-app-prd` (domain `vn-ams-badminton.com`) and `diemen-badminton-app-dev` (`dev.vn-ams-badminton.com`).

## Target structure (end state)

```
docs/
├── project-overview.md      (from prd.md)
├── system-architecture.md   (new)
├── database-schema.md
├── design-guidelines.md
├── local-development.md
├── deployment-guide.md      (Cloudflare canonical; absorbs cloudflare-deployment-guide.md)
├── code-standards.md         (new)
├── project-roadmap.md        (new)
├── soft-launch-playbook.md
└── future/
    ├── bunq-integration.md                       (from future-bunq-integration.md)
    └── refactor-write-audit-injectable-sb.md     (from suggestion/)
```

---

### Task 1: Establish folder structure and file moves

**Files:**
- Create dir: `docs/future/`
- Move: `docs/future-bunq-integration.md` → `docs/future/bunq-integration.md`
- Move: `docs/suggestion/refactor-write-audit-injectable-sb.md` → `docs/future/refactor-write-audit-injectable-sb.md`
- Move: `docs/prd.md` → `docs/project-overview.md`
- Remove dir: `docs/suggestion/` (after move)

- [ ] **Step 1: Baseline — confirm current files exist**

Run: `ls docs/prd.md docs/future-bunq-integration.md docs/suggestion/refactor-write-audit-injectable-sb.md`
Expected: all three listed (no error).

- [ ] **Step 2: Create future/ and move files with git mv**

```bash
mkdir -p docs/future
git mv docs/future-bunq-integration.md docs/future/bunq-integration.md
git mv docs/suggestion/refactor-write-audit-injectable-sb.md docs/future/refactor-write-audit-injectable-sb.md
git mv docs/prd.md docs/project-overview.md
rmdir docs/suggestion
```

- [ ] **Step 3: Verify new layout**

Run: `ls docs/future/ docs/project-overview.md && ! test -d docs/suggestion && echo OK`
Expected: lists `bunq-integration.md`, `refactor-write-audit-injectable-sb.md`, `docs/project-overview.md`, then `OK`.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add -A
git commit -m "refactor(docs): restructure into Approach B layout (move prd/future/suggestion)"
```

---

### Task 2: Rewrite deployment-guide.md (Cloudflare canonical) and delete the standalone CF guide

**Files:**
- Modify (rewrite): `docs/deployment-guide.md`
- Read for source: `docs/cloudflare-deployment-guide.md`, `wrangler.jsonc`, `open-next.config.ts`, `fly.toml`, `package.json`
- Delete: `docs/cloudflare-deployment-guide.md`

- [ ] **Step 1: Baseline — confirm Fly-only title is the current drift**

Run: `head -1 docs/deployment-guide.md`
Expected: `# Deployment Guide — Fly.io` (the drift we are replacing).

- [ ] **Step 2: Rewrite `docs/deployment-guide.md`**

Author these sections (pull Cloudflare detail from `docs/cloudflare-deployment-guide.md`, which is already accurate):
- H1: `# Deployment Guide`
- Intro: SSR app (27 API routes, cookie sessions, server actions, web-push) → not static; runs as a Cloudflare Worker via OpenNext.
- `## Cloudflare Workers (canonical)` — architecture diagram; two envs (`diemen-badminton-app-prd` → `vn-ams-badminton.com`, `diemen-badminton-app-dev` → `dev.vn-ams-badminton.com`); bindings `ASSETS`/`IMAGES`/`WORKER_SELF_REFERENCE`; `compatibility_flags: nodejs_compat`; `cf:build`/`cf:deploy:prd`/`cf:deploy:dev`/`cf:version`/`cf-typegen` scripts; build-time `NEXT_PUBLIC_*` vs runtime secrets via `wrangler secret put` (per-env); `.dev.vars` local preview; optional CI snippet; ops/troubleshooting/rollback tables.
- `## Alternatives` with two short subsections:
  - `### Fly.io` — `Dockerfile` + `fly.toml` committed; `fly deploy` with `--build-arg` for `NEXT_PUBLIC_*`; secrets via `fly secrets set`. 4–6 lines + pointer to `fly.toml`.
  - `### Vercel` — zero-config Next.js host; set the canonical env vars in project settings; no config file in repo. 3–4 lines.
- Use canonical env var names only. App name `VN-AMS Badminton`.

- [ ] **Step 3: Delete the absorbed standalone guide**

```bash
git rm docs/cloudflare-deployment-guide.md
```

- [ ] **Step 4: Verify content + absence**

Run: `head -1 docs/deployment-guide.md && grep -c "Cloudflare" docs/deployment-guide.md && grep -q "## Alternatives" docs/deployment-guide.md && echo HAS_ALT && ! test -f docs/cloudflare-deployment-guide.md && echo CF_GONE`
Expected: `# Deployment Guide`, a count ≥ 3, `HAS_ALT`, `CF_GONE`.

- [ ] **Step 5: Verify no old env names leaked in**

Run: `! grep -nE "SERVICE_ROLE_KEY|SUPABASE_ANON_KEY" docs/deployment-guide.md && echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 6: Commit (ask user first)**

```bash
git add docs/deployment-guide.md && git rm docs/cloudflare-deployment-guide.md
git commit -m "feat(docs): rewrite deployment guide around Cloudflare; fold in CF guide"
```

---

### Task 3: Rewrite project-overview.md (de-brand prd.md)

**Files:**
- Modify (rewrite): `docs/project-overview.md`

- [ ] **Step 1: Baseline — confirm brand drift present**

Run: `grep -nE "Smash Pro|Yonex|Royal Blue|Montserrat" docs/project-overview.md`
Expected: matches (the brand block we will remove).

- [ ] **Step 2: Rewrite `docs/project-overview.md`**

- H1: `# Project Overview`
- `## Purpose`: VN-AMS Badminton — mobile-friendly web app for a 30+ player Dutch (Diemen/Amsterdam) club. Monthly subscription poll, weekly RSVP (subscribers opt out, drop-ins opt in), honor-system Tikkie payment tracking.
- `## Season & Session model`: keep the existing season/session content from the old `prd.md` (it is accurate — seasons span `from_date`→`to_date`, `year_month` derived, auto-generated `scheduled` sessions at `court_count × 6`, per-session edits, ad-hoc sessions, cascade edits with 409 confirm, close cancels scheduled children + push).
- REMOVE the "Brand Identity / Design System" block entirely (it lives in `design-guidelines.md`). Add one line: `Visual design: see [design-guidelines.md](./design-guidelines.md).`

- [ ] **Step 3: Verify brand block gone, season model intact**

Run: `! grep -nE "Smash Pro|Yonex|Montserrat" docs/project-overview.md && echo DEBRANDED && grep -q "Season & Session" docs/project-overview.md && echo HAS_MODEL`
Expected: `DEBRANDED`, `HAS_MODEL`.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add docs/project-overview.md
git commit -m "feat(docs): rewrite project overview, de-brand to VN-AMS Badminton"
```

---

### Task 4: Create system-architecture.md (new)

**Files:**
- Create: `docs/system-architecture.md`
- Read for source: `src/middleware.ts`, `src/lib/auth/get-session.ts`, `next.config.mjs`, `wrangler.jsonc`, `src/lib/` (module names)

- [ ] **Step 1: Author `docs/system-architecture.md`**

Sections:
- H1 `# System Architecture`
- `## Runtime` — Next.js 15 standalone output compiled by OpenNext into a single Cloudflare Worker (`.open-next/worker.js`); `nodejs_compat`.
- `## Request flow` — RSC pages + 27 API route handlers (`src/app/api/**/route.ts`) + 1 server action (`src/lib/notifications/subscribe-actions.ts`); `src/middleware.ts` role (verify what it guards before writing).
- `## Auth & sessions` — PIN auth (bcryptjs hashes), session as jose-signed JWT in a cookie, read via `src/lib/auth/get-session.ts` (`next/headers` `cookies()`); server-only.
- `## Data layer` — Supabase Postgres; service-role key server-side only; deny-all RLS (browser client cannot read/write); lazy `resolve_session_cutoff` RPC. Link `[database-schema.md](./database-schema.md)`.
- `## Module map` — table of `src/lib/*` (admin, auth, db, notifications, referrals, seasons, sessions, supabase, waitlist + amsterdam-time-utils, format, utils) with one-line responsibilities (verify each by glancing at the dir).
- `## Notifications` — web-push with VAPID keys (server holds `VAPID_PRIVATE_KEY`).
- `## Deployment runtime` — bindings `ASSETS`/`IMAGES`/`WORKER_SELF_REFERENCE`; link `[deployment-guide.md](./deployment-guide.md)`.

- [ ] **Step 2: Verify structure**

Run: `head -1 docs/system-architecture.md && grep -cE "^## " docs/system-architecture.md`
Expected: `# System Architecture` and a heading count ≥ 6.

- [ ] **Step 3: Verify no forbidden facts**

Run: `! grep -nE "Smash Pro|vercel\.json|SERVICE_ROLE_KEY|SUPABASE_ANON_KEY" docs/system-architecture.md && echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add docs/system-architecture.md
git commit -m "feat(docs): add system architecture doc"
```

---

### Task 5: Create code-standards.md (new)

**Files:**
- Create: `docs/code-standards.md`
- Read for source: `CLAUDE.md` (modularization rules), `package.json` (scripts), `tsconfig.json`

- [ ] **Step 1: Author `docs/code-standards.md`**

Sections:
- H1 `# Code Standards`
- `## Language & types` — TypeScript strict; validate external input with zod at boundaries only (API routes, forms); trust internal calls.
- `## File organization` — 200-line modularization guideline; kebab-case, long descriptive filenames; split by responsibility not layer; check existing modules before adding new.
- `## Conventions` — money as integer cents; timestamps `timestamptz` UTC, display via `src/lib/amsterdam-time-utils.ts`; formatting helpers in `src/lib/format.ts`.
- `## Testing` — vitest (`pnpm test`, `pnpm test:watch`); **state honestly: coverage is currently minimal (1 test file)**; aspiration tracked in `[project-roadmap.md](./project-roadmap.md)`.
- `## Commits` — conventional types (`feat`/`fix`/`refactor`/`test`); note the `.claude` `chore`/`docs` exclusion rule.
- `## Tooling` — `pnpm` only; Node `^22 || >=24`; `pnpm lint`, `pnpm typecheck`.

- [ ] **Step 2: Verify**

Run: `head -1 docs/code-standards.md && grep -q "200" docs/code-standards.md && grep -qi "vitest" docs/code-standards.md && echo OK`
Expected: `# Code Standards`, `OK`.

- [ ] **Step 3: Commit (ask user first)**

```bash
git add docs/code-standards.md
git commit -m "feat(docs): add code standards doc"
```

---

### Task 6: Create project-roadmap.md (new)

**Files:**
- Create: `docs/project-roadmap.md`

- [ ] **Step 1: Author `docs/project-roadmap.md`**

- H1 `# Project Roadmap`
- `## Now (v1)` — manual Tikkie + honor-system payment tracking; subscription poll; weekly RSVP; referrals; slot passing; push notifications.
- `## Rollout` — one-line summary + link `[soft-launch-playbook.md](./soft-launch-playbook.md)` (do NOT duplicate phase detail).
- `## Future` — bullet index linking `[future/bunq-integration.md](./future/bunq-integration.md)` (auto-reconciliation, deferred) and `[future/refactor-write-audit-injectable-sb.md](./future/refactor-write-audit-injectable-sb.md)` (testability refactor). Add "increase test coverage" as a tracked aspiration.

- [ ] **Step 2: Verify links resolve**

Run: `for f in $(grep -oE '\]\(\.\/[^)]+\)' docs/project-roadmap.md | sed -E 's/\]\(\.\///;s/\)//'); do test -e "docs/$f" && echo "OK $f" || echo "BROKEN $f"; done`
Expected: every line `OK ...`, no `BROKEN`.

- [ ] **Step 3: Commit (ask user first)**

```bash
git add docs/project-roadmap.md
git commit -m "feat(docs): add project roadmap doc"
```

---

### Task 7: Refresh database-schema.md

**Files:**
- Modify: `docs/database-schema.md`
- Read for source: `supabase/migrations/0021_*.sql`, `0022_*.sql`, `0023_*.sql`

- [ ] **Step 1: Verify schema doc against latest migrations**

Read `0021_re_add_season_schedule.sql`, `0022_season_range_and_session_end_at.sql`, `0023_add_passed_rsvp_status.sql`. Confirm the doc's `seasons` columns (`from_date`,`to_date`,`weekday`,`start_time`,`end_time`), `sessions.end_at`, and `rsvp_status` enum including `passed` all match. Fix any divergence.

- [ ] **Step 2: Confirm enums/notes already correct**

The doc already reflects dropped `subscriptions` table (0017) and `assumed_paid/flagged/unpaid`. Leave correct content intact; only fix divergences found in Step 1. Ensure app name references (if any) say VN-AMS.

- [ ] **Step 3: Verify**

Run: `grep -q "passed" docs/database-schema.md && ! grep -nE "self_marked_paid|admin_confirmed" docs/database-schema.md && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add docs/database-schema.md
git commit -m "fix(docs): refresh database schema to migration 0023"
```

---

### Task 8: Refresh design-guidelines.md (rebrand + verify tokens)

**Files:**
- Modify: `docs/design-guidelines.md`
- Read for source: `src/app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Baseline — brand naming drift**

Run: `grep -nE "Smash Pro" docs/design-guidelines.md`
Expected: matches present.

- [ ] **Step 2: Rebrand + verify token values**

Replace "Smash Pro / Diemen Badminton" naming with "VN-AMS Badminton". Spot-check the color tokens (`--brand`, `--primary`, `--warning`, `--destructive`) and radius against `src/app/globals.css`; fix any mismatch. Keep the doc's structure.

- [ ] **Step 3: Verify**

Run: `! grep -nE "Smash Pro" docs/design-guidelines.md && echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add docs/design-guidelines.md
git commit -m "fix(docs): rebrand design guidelines to VN-AMS Badminton"
```

---

### Task 9: Refresh local-development.md

**Files:**
- Modify: `docs/local-development.md`
- Read for source: `package.json` (`db:*` scripts), `supabase/config.toml`

- [ ] **Step 1: Verify scripts/ports/CLI**

Confirm every `pnpm db:*` command in the doc exists in `package.json` scripts; confirm ports (54321/54322/54323) against `supabase/config.toml`; confirm env var names are canonical (doc already uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` — good). Fix any divergence. Ensure no Vercel-as-only-prod implication; link `[deployment-guide.md](./deployment-guide.md)` for prod.

- [ ] **Step 2: Verify**

Run: `for s in db:start db:stop db:reset db:status db:studio db:migrate:new db:env; do grep -q "\"$s\"" package.json && echo "OK $s" || echo "MISSING $s"; done`
Expected: all `OK`. If any `MISSING`, correct the doc to match actual script names.

- [ ] **Step 3: Commit (ask user first)**

```bash
git add docs/local-development.md
git commit -m "fix(docs): verify local-development commands and env names"
```

---

### Task 10: Refresh soft-launch-playbook.md

**Files:**
- Modify: `docs/soft-launch-playbook.md`

- [ ] **Step 1: Baseline — Vercel + stale migration list drift**

Run: `grep -nE "Vercel|0008_add_location" docs/soft-launch-playbook.md`
Expected: matches present.

- [ ] **Step 2: Apply fixes**

- Replace the hand-listed migration set (`0001…0008`) with: "apply all migrations in `supabase/migrations/` (`supabase db push`)".
- Replace "Vercel project deployed" / "env vars set in Vercel" / "Vercel Analytics" with Cloudflare equivalents (Worker deployed to `vn-ams-badminton.com`; secrets via `wrangler secret put`; Cloudflare Workers logs/analytics). Keep "Supabase logs" + "audit log" monitoring.
- Update env-var checklist to canonical names.
- Title/app name → VN-AMS Badminton. Keep the 3-phase structure and the post-0017 smoke test (valid).

- [ ] **Step 3: Verify**

Run: `! grep -nE "Vercel|0008_add_location|SERVICE_ROLE_KEY" docs/soft-launch-playbook.md && echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add docs/soft-launch-playbook.md
git commit -m "fix(docs): update soft-launch playbook to Cloudflare + current migrations"
```

---

### Task 11: Refresh future/bunq-integration.md

**Files:**
- Modify: `docs/future/bunq-integration.md`

- [ ] **Step 1: Baseline — stale schema refs**

Run: `grep -nE "subscriptions\.|owed|self_marked_paid|admin_confirmed|subscription_fee_cents|Vercel" docs/future/bunq-integration.md`
Expected: matches present (the drift to fix).

- [ ] **Step 2: Apply fixes**

- Payment states → `assumed_paid`/`flagged`/`unpaid`. Match payments against `attendance` rows (no `subscriptions` table).
- Fee columns → `subscription_fee_per_session_cents`, `drop_in_fee_per_session_cents`.
- "Add `BUNQ_*` to Vercel env vars" → "set `BUNQ_*` Cloudflare secrets via `wrangler secret put`".
- Keep edge/low-latency note as Workers-native. Keep `bunq_payment_id` column note (still exists on `attendance`). Update `**Last reviewed:**` to `2026-06-08`.

- [ ] **Step 3: Verify**

Run: `! grep -nE "subscriptions\.|owed|self_marked_paid|admin_confirmed|subscription_fee_cents|Vercel" docs/future/bunq-integration.md && echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 4: Commit (ask user first)**

```bash
git add docs/future/bunq-integration.md
git commit -m "fix(docs): refresh bunq future doc to current schema and Cloudflare"
```

---

### Task 12: Verify future/refactor-write-audit-injectable-sb.md

**Files:**
- Modify (if needed): `docs/future/refactor-write-audit-injectable-sb.md`
- Read for source: `src/lib/admin/audit.ts`

- [ ] **Step 1: Confirm proposal still matches code**

Read `src/lib/admin/audit.ts`. Confirm `writeAudit` still calls `createServerSupabase()` internally and still lacks an injectable `sb` param. If signature changed, update the doc's "current" snippet to match; if already refactored, mark the doc `Status: done` with a one-line note.

- [ ] **Step 2: Verify**

Run: `grep -q "writeAudit" docs/future/refactor-write-audit-injectable-sb.md && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit (ask user first)**

```bash
git add docs/future/refactor-write-audit-injectable-sb.md
git commit -m "fix(docs): verify audit refactor suggestion against current code"
```

---

### Task 13: Rewrite README.md

**Files:**
- Modify (rewrite): `README.md`
- Read for source: `package.json`, `env.example.txt`

- [ ] **Step 1: Baseline — old env names + Vercel default + stale migrations**

Run: `grep -nE "SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|Vercel|0003_rls_policies" README.md`
Expected: matches present.

- [ ] **Step 2: Rewrite `README.md`**

- H1 `# VN-AMS Badminton`
- One-paragraph overview (30+ player Dutch club app; poll/RSVP/honor-Tikkie).
- `## Stack`: Next.js 15 App Router (TS) + Supabase (Postgres + RLS) + Tailwind + shadcn/ui + OpenNext/Cloudflare Workers.
- `## Quickstart`: prerequisites (Node `^22 || >=24`, `corepack enable`, Docker for local Supabase); `pnpm install`; local DB via `pnpm db:start` + `pnpm db:env`; `pnpm dev`. Link `[local-development.md](./docs/local-development.md)`.
- `## Environment`: canonical env-var table (the 9 vars). No old names.
- `## Deployment`: one line → Cloudflare; link `[deployment-guide.md](./docs/deployment-guide.md)`.
- `## Docs`: index with relative links to every `docs/*.md` (overview, architecture, schema, design, local-dev, deployment, code-standards, roadmap, playbook, future/).
- Replace the hand-listed migrations with "apply all migrations in `supabase/migrations/`".

- [ ] **Step 3: Verify**

Run: `head -1 README.md && ! grep -nE "SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|Smash Pro" README.md && echo CLEAN`
Expected: `# VN-AMS Badminton`, `CLEAN`.

- [ ] **Step 4: Verify docs index links resolve**

Run: `for f in $(grep -oE '\]\(\.\/docs\/[^)]+\)' README.md | sed -E 's/\]\(\.\///;s/\)//'); do test -e "$f" && echo "OK $f" || echo "BROKEN $f"; done`
Expected: all `OK`, no `BROKEN`.

- [ ] **Step 5: Commit (ask user first)**

```bash
git add README.md
git commit -m "feat(docs): rewrite README around VN-AMS Badminton + Cloudflare"
```

---

### Task 14: Light pass on env.example.txt

**Files:**
- Modify: `env.example.txt`

- [ ] **Step 1: Align comments + var set**

Confirm the file lists exactly the 9 canonical vars with accurate inline comments (generation hints for `SESSION_SECRET` and VAPID keys, `VAPID_SUBJECT` example). No structural change; fix any comment drift. No app-name/brand or deploy claims here.

- [ ] **Step 2: Verify**

Run: `for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY SESSION_SECRET TIKKIE_DEFAULT_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT; do grep -q "$v" env.example.txt && echo "OK $v" || echo "MISSING $v"; done`
Expected: all `OK`.

- [ ] **Step 3: Commit (ask user first)**

```bash
git add env.example.txt
git commit -m "fix(docs): tidy env.example comments"
```

---

### Task 15: Rewrite CLAUDE.md (trim to reality)

**Files:**
- Modify (rewrite): `CLAUDE.md`

- [ ] **Step 1: Baseline — dangling references present**

Run: `grep -nE "\.claude/rules|orchestration-protocol|skills/\.venv|sub-agent" CLAUDE.md`
Expected: matches present (what we remove).

- [ ] **Step 2: Rewrite `CLAUDE.md`**

KEEP/UPDATE:
- Role summary (1–2 lines).
- `## Documentation` block listing the **real** Approach B `docs/` set (project-overview, system-architecture, database-schema, design-guidelines, local-development, deployment-guide, code-standards, project-roadmap, soft-launch-playbook, future/). Replace the old aspirational list.
- Git commit conventions (keep `.claude` `chore`/`docs` clause as a forward-looking note, or drop — implementer's call per spec).
- 200-line modularization guidance.
- Privacy-block hook protocol (`@@PRIVACY_PROMPT@@` + AskUserQuestion flow) — keep verbatim.
- Today's-date / read-README-first guidance (keep, point to README + docs).

REMOVE:
- All `.claude/rules/*.md` workflow links and the "Workflows" list.
- Sub-agent orchestration protocol section.
- Skills `.venv` Python instructions.

- [ ] **Step 3: Verify no dangling repo paths remain**

Run: `grep -nE "\.claude/rules|orchestration-protocol|skills/\.venv" CLAUDE.md; echo "exit:$?"`
Expected: no matches (grep `exit:1`).

- [ ] **Step 4: Verify documentation block matches real files**

Run: `for f in project-overview system-architecture database-schema design-guidelines local-development deployment-guide code-standards project-roadmap soft-launch-playbook; do test -f "docs/$f.md" && echo "OK $f" || echo "MISSING $f"; done`
Expected: all `OK`.

- [ ] **Step 5: Commit (ask user first)**

```bash
git add CLAUDE.md
git commit -m "refactor: trim CLAUDE.md to repo reality, update docs index"
```

---

### Task 16: Cross-cutting verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Forbidden strings across all docs**

Run:
```bash
grep -rniE "smash pro|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|self_marked_paid|admin_confirmed" README.md CLAUDE.md docs env.example.txt; echo "exit:$?"
```
Expected: no matches (`exit:1`). Any hit → fix in the owning file.

- [ ] **Step 2: No stale standalone files remain**

Run: `! test -f docs/cloudflare-deployment-guide.md && ! test -f docs/prd.md && ! test -d docs/suggestion && ! test -f docs/future-bunq-integration.md && echo OK`
Expected: `OK`.

- [ ] **Step 3: All relative doc links resolve**

Run:
```bash
fail=0
for doc in README.md docs/*.md docs/future/*.md; do
  base=$(dirname "$doc")
  for link in $(grep -oE '\]\([^)#]+\.md[^)]*\)' "$doc" | sed -E 's/\]\(//;s/\)//;s/#.*//'); do
    case "$link" in http*) continue;; esac
    target="$base/$link"
    [ -e "$target" ] || { echo "BROKEN $doc -> $link"; fail=1; }
  done
done
[ $fail -eq 0 ] && echo "ALL LINKS OK"
```
Expected: `ALL LINKS OK`.

- [ ] **Step 4: Deploy guide leads with Cloudflare**

Run: `grep -n "Cloudflare" docs/deployment-guide.md | head -1 && grep -n "## Alternatives" docs/deployment-guide.md`
Expected: Cloudflare appears before/around the alternatives heading; `## Alternatives` present.

- [ ] **Step 5: Each doc has exactly one H1**

Run: `for d in README.md CLAUDE.md docs/*.md docs/future/*.md; do n=$(grep -cE "^# " "$d"); echo "$n $d"; done | grep -vE "^1 " && echo "CHECK ABOVE" || echo "ALL SINGLE H1"`
Expected: `ALL SINGLE H1` (any non-`1` line is flagged for fixing).

- [ ] **Step 6: Final commit (ask user first; only if Steps fixed anything)**

```bash
git add -A
git commit -m "fix(docs): cross-cutting consistency sweep"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** every target file + deletion/move in the spec maps to a task (T1 moves; T2 deploy+CF delete; T3 overview; T4 architecture; T5 code-standards; T6 roadmap; T7 schema; T8 design; T9 local-dev; T10 playbook; T11 bunq; T12 audit-refactor; T13 README; T14 env.example; T15 CLAUDE.md; T16 sweep). Acceptance criteria → T16.
- **Placeholders:** none — each task names exact files, exact facts to encode, and runnable verification. Prose authored at execution by design (documentation task); section outlines + canonical facts make content unambiguous.
- **Type/string consistency:** forbidden/canonical string lists are identical across baseline greps and the final sweep (T16 Step 1).
- **Open spec questions:** resolved via spec defaults (code-standards describes current minimal test state; playbook kept separate, linked from roadmap).
