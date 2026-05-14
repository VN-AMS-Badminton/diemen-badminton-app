# Design System: High-Velocity Precision

Yonex-inspired design language for Smash Pro / Diemen Badminton. Royal Blue authority + Emerald action, sharp typography, mobile-first, high contrast.

## 1. Principles

1. **Precision over decoration** — clean lines, generous whitespace, purposeful color
2. **Action is emerald** — CTAs and positive states use emerald; everything else stays neutral
3. **Authority is royal blue** — brand chrome, headers, nav, secondary structure
4. **Mobile-first** — 44px tap targets minimum, single-column flow on phones
5. **Honest hierarchy** — one primary action per screen, never compete colors
6. **Athletic restraint** — bold sans-serif, tight tracking, no gimmicks

## 2. Color Tokens

PRD terminology → CSS token mapping:

| PRD Name | Role | CSS Token | Light HSL | Hex |
|---|---|---|---|---|
| Royal Blue (Primary brand) | Chrome, nav, identity, links | `--brand` | `211 100% 26%` | `#004185` |
| Emerald (Accent / CTAs) | Default action, success | `--primary` | `159 100% 26%` | `#008552` |
| Amber | Warning, payment due | `--warning` | `38 92% 50%` | `#f59e0b` |
| Red | Destructive | `--destructive` | `0 84% 50%` | `#ef4444` |

**Why this mapping:** `<Button>` defaults to `--primary` in shadcn. PRD says emerald = CTAs. Mapping emerald → `--primary` makes every existing `<Button>` correct without code changes. Royal Blue becomes `--brand` for chrome (admin nav, headers, brand bar).

### Neutrals (cool slate, athletic feel)

| Token | Light HSL | Dark HSL |
|---|---|---|
| `--background` | `0 0% 100%` | `222 30% 8%` |
| `--foreground` | `222 20% 12%` | `210 20% 96%` |
| `--card` | `0 0% 100%` | `222 25% 12%` |
| `--muted` | `210 20% 96%` | `222 20% 16%` |
| `--muted-foreground` | `215 15% 40%` | `215 15% 65%` |
| `--border` | `214 20% 89%` | `222 20% 20%` |
| `--input` | `214 20% 89%` | `222 20% 20%` |
| `--ring` | `159 100% 26%` (emerald) | `159 80% 45%` |

Hover/active for primary and brand use lightness shifts (+6%, -6%).

## 3. Typography

**Font:** Montserrat (Google Fonts, via `next/font`). Loaded once at root layout.

| Use | Weight | Size | Tracking |
|---|---|---|---|
| Display (hero) | 800 | 30-36px | -0.02em |
| H1 (page title) | 700 | 24px | -0.015em |
| H2 (card title) | 600 | 18px | -0.01em |
| Body | 400/500 | 14-16px | 0 |
| Overline (labels) | 700 | 11px | 0.08em, UPPERCASE |
| Caption / hint | 500 | 12px | 0 |
| Tabular numeric (money, scores) | 600 | inherit | `font-variant-numeric: tabular-nums` |

## 4. Spacing & Layout

- Base unit: 4px (Tailwind default)
- Mobile container: `max-w-md` (player), `max-w-6xl` (admin)
- Section gap: `space-y-6` (24px) on mobile, `space-y-8` on desktop
- Card padding: `p-5` (20px)
- Min tap target: 44x44px (`h-11`)

## 5. Radius & Elevation

- `--radius: 0.5rem` (8px) — cards, inputs
- Buttons: `rounded-md` (6px) — slight tighter for precision feel
- Pills/badges: `rounded-full`
- Elevation:
  - `shadow-sm` for cards (default)
  - `shadow-md` for elevated CTAs only (sparingly)
  - Custom blue-tinted shadow on hover for brand cards: `0 4px 14px 0 hsl(211 100% 26% / 0.08)`

## 6. Components

### Button

| Variant | Use | Style |
|---|---|---|
| `default` | Primary CTA | Emerald fill, white text |
| `brand` | Brand / secondary action | Royal Blue fill, white text |
| `outline` | Tertiary | Border, transparent fill, hover muted |
| `ghost` | Toolbar, table actions | No border, hover muted |
| `destructive` | Destructive | Red fill |
| `link` | Inline link | Brand color, underline on hover |

All buttons: `h-11` default, `h-9` sm, `h-12` lg.

### Badge / Status Pill

| Variant | Use | Style |
|---|---|---|
| `default` | Generic | Emerald soft |
| `brand` | Brand chip | Royal Blue soft |
| `success` | Paid, opted-in | Emerald soft bg + dark emerald text |
| `warning` | Due, pending | Amber soft bg + dark amber text |
| `destructive` | Overdue, blocked | Red soft bg + dark red text |
| `outline` | Neutral status | Border only |

### Card

- Default: white bg, 1px border `--border`, `shadow-sm`, `rounded-lg`
- **BrandCard variant:** adds a 3px Royal Blue top accent stripe (for hero/feature cards like "Next session", "Active poll")
- Hover state for clickable cards: lift via `shadow-md` + border tint to brand-10%

### Input

- `h-11`, `rounded-md`, focus ring uses `--ring` (emerald)
- Error state: `border-destructive`, helper text below

### Nav (Admin)

- Royal Blue header bar (brand-on-brand)
- Sub-nav: muted bg with active item using emerald underline
- Mobile: horizontal scrolling tab strip

### Section Header (new convention)

```
[OVERLINE LABEL]      (uppercase, brand color, tracking-wide)
Page or Card Title    (bold, slate-900)
Optional description  (muted-foreground)
```

## 7. Iconography

- Lucide React (already installed)
- Stroke width: 1.75 (slightly bolder than default for athletic feel)
- Size: 16px inline, 20px in buttons, 24px standalone

## 8. Motion

- Transitions: 150ms ease-out for hover/focus
- Page transitions: rely on Next.js default
- Respect `prefers-reduced-motion`

## 9. Accessibility

- Min contrast ratio 4.5:1 for text, 3:1 for UI components
- Focus rings always visible (`focus-visible:ring-2 ring-ring`)
- Tap targets ≥ 44px
- Semantic HTML (`<main>`, `<nav>`, `<header>`, `<button>`)

## 10. Refactor Scope (initial pass)

Files touched in this refactor:
- `src/app/globals.css` — token rewrite
- `tailwind.config.ts` — Montserrat, brand color, shadow utilities
- `src/app/layout.tsx` — Montserrat loader, body font class
- `src/components/ui/button.tsx` — add `brand` variant, tighter radius
- `src/components/ui/badge.tsx` — soft brand/success/warning/destructive variants
- `src/components/ui/card.tsx` — `BrandCard` accent-stripe variant
- `src/app/page.tsx` (login) — hero treatment with brand accent
- `src/app/dashboard/page.tsx` — section overlines, brand chips
- `src/app/admin/layout.tsx` — Royal Blue header bar, emerald active state
- `src/components/player/next-session-card.tsx` — BrandCard, emerald CTA
- `src/components/player/season-poll-card.tsx` — BrandCard
