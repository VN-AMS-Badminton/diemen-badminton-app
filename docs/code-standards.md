# Code Standards

Conventions for the **VN-AMS Badminton** codebase (Next.js 15 App Router, TypeScript, Supabase).

---

## Language & types

| Setting | Value |
|---|---|
| TypeScript mode | `strict: true` (see `tsconfig.json`) |
| Target | ES2022 |
| Path alias | `@/*` → `src/*` |

- Validate external input with **zod** at trust boundaries only: API route handlers and form submissions.
- Trust internal function calls — do not add defensive checks for states that cannot occur.
- Prefer explicit return types on exported functions; inference is fine for internal helpers.

---

## File organization

- **200-line guideline** — when a file exceeds ~200 lines, consider splitting it. This is a guideline, not a hard rule.
- **Check existing modules first** before creating a new file. Prefer extending a focused existing module over creating a parallel one.
- **Split by responsibility**, not by technical layer. A file that handles "session pass-slot logic" is better than a generic `utils.ts` that grows unbounded.
- **Filename convention** — kebab-case, long descriptive names are encouraged (e.g. `amsterdam-time-utils.ts`, `pass-slot-validation.ts`). Long names are fine; self-documenting filenames improve LLM and human navigation alike.
- Exceptions: markdown files, plain-text files, bash scripts, and config files are not subject to the modularization guideline.

Directory layout (abbreviated):

```
src/
  app/          # Next.js App Router pages and API routes
  components/   # Shared React components
  lib/          # Domain logic, utilities, Supabase helpers
    amsterdam-time-utils.ts
    format.ts
    ...
  types/        # Shared TypeScript types
```

---

## Domain conventions

| Concern | Convention |
|---|---|
| Money | Stored as **integer cents** in the database; format for display with helpers in `src/lib/format.ts` |
| Timestamps | `timestamptz` columns in Supabase (UTC storage); convert and format for display via `src/lib/amsterdam-time-utils.ts` |
| Shared formatting | Centralise display-formatting helpers in `src/lib/format.ts`; avoid ad-hoc inline formatting scattered across components |

---

## Testing

- Framework: **vitest** (`^4.x`)
- Commands:

  ```bash
  pnpm test        # single run (CI)
  pnpm test:watch  # watch mode (development)
  ```

- **Coverage is currently minimal.** There is one test file in `src/` (`src/lib/sessions/__tests__/pass-slot.test.ts`). Expanding test coverage is tracked in [project-roadmap.md](./project-roadmap.md).
- Place test files in a `__tests__/` directory adjacent to the module under test.

---

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) types:

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `test` | Adding or updating tests |

- Subject line: short, imperative, no trailing period (`feat(sessions): add pass-slot transfer`).
- Do **not** use `chore` or `docs` for changes inside the `.claude/` directory.

---

## Tooling

| Tool | Requirement |
|---|---|
| Package manager | **pnpm** only (`pnpm@10.26.1` pinned) — do not use npm or yarn |
| Node | `^22 \|\| >=24` |
| Lint | `pnpm lint` (ESLint via `eslint-config-next`) |
| Type-check | `pnpm typecheck` (`tsc --noEmit`) |

Run `pnpm lint` and `pnpm typecheck` before pushing. Both must pass cleanly.
