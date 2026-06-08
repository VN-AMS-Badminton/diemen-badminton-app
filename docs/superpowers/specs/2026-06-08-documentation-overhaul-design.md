# Documentation Overhaul — Design Spec

**Date:** 2026-06-08
**Status:** approved-for-planning
**Scope:** Full rewrite of all repo documentation, including `CLAUDE.md`.

## Goal

Make every doc in the repo accurate, internally consistent, and well-structured. The repo's docs have drifted from the code: three different deploy targets are described, the app has three different names, migration lists are stale, env var names are inconsistent, and `CLAUDE.md` points at a `.claude/` directory that does not exist.

This overhaul does three things at once (the user chose "full overhaul"): fix accuracy, restructure to a coherent docs set, and tighten tone.

## Locked Decisions

| Decision | Choice |
|---|---|
| Scope | Everything: `docs/`, `README.md`, `env.example.txt`, `CLAUDE.md` |
| Intent | Full overhaul (accuracy + restructure + tone) |
| Canonical deploy target | **Cloudflare Workers** (matches live `vn-ams-badminton.com` + recent commits). Fly + Vercel demoted to an "Alternatives" subsection |
| Canonical app name | **VN-AMS Badminton** (domain-aligned). Remove "Smash Pro"; "Diemen Badminton" allowed as the club/locale descriptor |
| Target structure | **Approach B** — prescribed core + retained high-value standalone docs; update `CLAUDE.md` to describe the real set |
| Bunq future doc | **Refresh & keep** — update to current schema/enums, keep as deferred |
| CLAUDE.md | **Trim to reality** — remove dangling `.claude/rules/*`, sub-agent orchestration, and skills-venv references |

## Ground Truth (verified)

- **Migrations:** `supabase/migrations/0001` … `0023` exist (23 files). README lists only 0001–0003; playbook lists 0001–0008 — both stale.
- **Deploy artifacts committed:** `Dockerfile`, `.dockerignore`, `fly.toml` (Fly); `wrangler.jsonc`, `open-next.config.ts` (Cloudflare). **No** `vercel.json`. Live custom domain `vn-ams-badminton.com` is in `wrangler.jsonc`.
- **Canonical env vars** (`env.example.txt`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `TIKKIE_DEFAULT_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. README uses old `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
- **Payment enums:** `assumed_paid`, `flagged`, `unpaid`. `subscriptions` table dropped in migration 0017 (subscribers are now `attendance` rows with `source='subscription'`).
- **`src/` layout:** `app/`, `components/` (`admin/`, `auth/`, `player/`, `ui/`), `lib/` (`admin/`, `auth/`, `db/`, `notifications/`, `referrals/`, `seasons/`, `sessions/`, `supabase/`, `waitlist/` + `amsterdam-time-utils.ts`, `format.ts`, `utils.ts`), `middleware.ts`. 27 API routes under `app/api/`. 1 server-action file. 1 test file (`*.test.ts`).
- **`.claude/` directory does not exist** in this repo. All `CLAUDE.md` references to `.claude/rules/*.md` and `.claude/skills/.venv` are dangling.
- **Engines:** Node `^22 || >=24`; package manager `pnpm@10` (pinned via `packageManager`).
- Stack confirmed: Next.js 15 App Router (TS), Supabase (Postgres + deny-all RLS), Tailwind + shadcn/ui, jose (session JWT), bcryptjs (PIN hash), web-push (VAPID), OpenNext → Cloudflare Worker.

## Target Structure (Approach B)

```
docs/
├── project-overview.md      # product purpose + season/session model (from prd.md, de-branded)
├── system-architecture.md   # NEW: runtime, request flow, auth, RLS, module map
├── database-schema.md        # keep; refresh to migration 0023
├── design-guidelines.md      # keep; rebrand Smash Pro → VN-AMS Badminton
├── local-development.md       # keep; verify commands/ports/CLI version
├── deployment-guide.md        # rewrite: Cloudflare canonical + Fly/Vercel alternatives
├── code-standards.md          # NEW: conventions distilled from code + CLAUDE.md rules
├── project-roadmap.md         # NEW: milestones + index into playbook/future
├── soft-launch-playbook.md    # keep; refresh facts
└── future/
    ├── bunq-integration.md     # moved + refreshed
    └── refactor-write-audit-injectable-sb.md  # moved from suggestion/
```

**Deletions / moves:**
- Delete `docs/cloudflare-deployment-guide.md` (content absorbed into `deployment-guide.md`).
- `docs/prd.md` → `docs/project-overview.md` (renamed, de-branded, season model retained).
- `docs/suggestion/` → `docs/future/` (folder retired).

## Cross-Cutting Rules (apply to all docs)

1. App name "VN-AMS Badminton"; no "Smash Pro".
2. Cloudflare is the deploy default; Fly/Vercel only under an explicit "Alternatives" heading.
3. Do not hand-enumerate migrations; reference `supabase/migrations/` and the current head (0023) where a number is needed.
4. Use the canonical env var names only.
5. Use current payment enums; never reference the dropped `subscriptions` table or old `owed`/`self_marked_paid`/`admin_confirmed` states.
6. pnpm for all commands; Node 22 || >=24.

## Tone & Style Conventions

- Concise, present-tense, declarative. No marketing copy.
- One H1 title per doc; sentence-case headings.
- Prefer tables for enumerable facts (env vars, commands, enums, variants).
- Relative links between docs (e.g. `[schema](./database-schema.md)`).
- "Last reviewed: YYYY-MM-DD" line only on `future/` (speculative) docs.
- Sacrifice grammar for concision where it improves scannability (per repo CLAUDE.md preference).

## Per-File Content Plan

### `README.md` (rewrite)
Overview (what/who), real stack, prerequisites (Node, pnpm, Docker for local Supabase), quickstart (`pnpm install` → local Supabase → `pnpm dev`), canonical env table, "Deploy" pointing to `docs/deployment-guide.md` (Cloudflare), and a docs index with relative links. Remove old env names, Vercel-as-default, and the hand-listed migrations.

### `docs/project-overview.md` (new, from `prd.md`)
Purpose (30+ player Dutch club: monthly subscription poll, weekly RSVP, honor-system Tikkie payments). Season & session model (verbatim-quality content from `prd.md`, kept — it is accurate). Drop the "Smash Pro / brand identity" block (brand lives in `design-guidelines.md`).

### `docs/system-architecture.md` (new)
Runtime (Next 15 standalone → OpenNext Worker), request flow (RSC + 27 API routes + 1 server action), `middleware.ts` role, auth/session (jose-signed cookie, bcrypt PINs, `get-session`), data layer (Supabase service-role server-side only, deny-all RLS), module map of `src/lib/*`, web-push path, and how this maps onto Cloudflare bindings (ASSETS/IMAGES/WORKER_SELF_REFERENCE). Cross-link schema + deployment docs.

### `docs/database-schema.md` (refresh)
Keep ERD/enums/notes; re-verify against migrations through 0023 (season schedule re-add 0021, season range + `session end_at` 0022, `passed` rsvp_status 0023). Confirm enum tables and stored-function list still match.

### `docs/design-guidelines.md` (refresh)
Keep tokens/typography/components. Replace "Smash Pro" naming with "VN-AMS Badminton". Verify token values against `globals.css`/`tailwind.config.ts` during implementation.

### `docs/local-development.md` (refresh)
Already largely accurate. Verify Supabase CLI version, ports, and the `pnpm db:*` script names against `package.json`.

### `docs/deployment-guide.md` (rewrite)
Canonical Cloudflare section (absorb the existing `cloudflare-deployment-guide.md` content: envs `prd`/`dev`, domains, secrets via `wrangler secret put`, `cf:*` scripts, `.dev.vars`, optional CI, ops/troubleshooting/rollback). Add a compact "Alternatives" section summarizing Fly.io (`fly.toml`/Docker) and Vercel (zero-config), each a few lines pointing at their config.

### `docs/code-standards.md` (new)
TS strict; 200-line modularization rule (from CLAUDE.md); kebab-case long descriptive filenames; boundary-only validation (zod at edges); money as integer cents; Amsterdam-time helper usage; testing (vitest configured; coverage currently minimal — state honestly); commit message conventions (no `chore`/`docs` for `.claude` changes — but note `.claude` absent, so this rule may be dropped/adjusted).

### `docs/project-roadmap.md` (new)
v1 status (manual Tikkie + honor system), near-term milestones, and an index linking to `soft-launch-playbook.md` and `future/`. No duplication of playbook detail.

### `docs/soft-launch-playbook.md` (refresh)
Keep 3-phase structure. Replace Vercel references with Cloudflare. Replace the hand-listed migration set with a pointer. Update env-var checklist to canonical names. Keep the post-0017 smoke test (still valid).

### `docs/future/bunq-integration.md` (move + refresh)
Update payment states to `assumed_paid`/`flagged`/`unpaid`; remove `subscriptions`-table references (match on `attendance` rows); fix fee column names (`subscription_fee_per_session_cents`, `drop_in_fee_per_session_cents`); change "Vercel env" → Cloudflare secrets; keep edge-runtime note as Workers-native. Refresh "Last reviewed" date.

### `docs/future/refactor-write-audit-injectable-sb.md` (move)
Verify the proposal still matches `src/lib/admin/audit.ts` during implementation; move under `future/`.

### `env.example.txt` (light pass)
Ensure comments are accurate and the set matches the canonical list. No structural change.

### `CLAUDE.md` (rewrite — trim to reality)
Keep: role summary, **updated** documentation-structure block (Approach B set), git commit conventions (adjust/remove the `.claude` clause since `.claude/` is absent), 200-line modularization guidance, privacy-block hook protocol. Remove: `.claude/rules/*` workflow links, sub-agent orchestration protocol, skills `.venv` Python instructions — none exist in this repo.

## Acceptance Criteria

- No doc references "Smash Pro", `vercel.json` as primary, old env var names, the `subscriptions` table, or a hand-listed migration range that contradicts 0001–0023.
- `CLAUDE.md` contains no path that does not resolve in the repo.
- Every relative cross-link between docs resolves.
- `docs/` matches the Approach B tree; `prd.md`, `cloudflare-deployment-guide.md`, and `suggestion/` are gone.
- Deploy guide leads with Cloudflare; Fly/Vercel only under "Alternatives".
- Each rewritten doc has a single H1 and consistent heading case.

## Risks / Notes

- **Token/values verification:** `design-guidelines.md` and `database-schema.md` claim specific values; must be checked against source files during implementation, not assumed.
- **CLAUDE.md behavior change:** trimming orchestration text changes how future agent sessions are guided in this repo. This is intended (the referenced files don't exist) but is the highest-blast-radius edit — call it out in the PR.
- **No `.claude/` dir:** the commit-message rule about `.claude` becomes moot; decide during implementation whether to drop it or keep a forward-looking note.

## Open Questions

- Should `code-standards.md` also codify the test strategy (e.g. "add a test per lib module"), or just describe the current minimal state? (Default: describe current state, note aspiration in roadmap.)
- Keep `soft-launch-playbook.md` separate vs. folding into `project-roadmap.md`? (Default per Approach B: keep separate, link from roadmap.)
