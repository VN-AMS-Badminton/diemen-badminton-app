# Admin Flow

What an admin can do and where. Terms: see [glossary.md](./glossary.md).

Admins are `players` rows with `role = 'admin'`. Access control:

- Pages: `/admin/*` is gated in `src/middleware.ts` (non-admin session → `/forbidden`).
- APIs: every `/api/admin/*` route calls `requireAdmin()` (`src/lib/auth/get-session.ts`).
- All admin mutations write to `audit_log` via `writeAudit()` (`src/lib/admin/audit.ts`).

Admin nav (`src/components/admin/admin-nav.tsx`): Dashboard, Players, Sessions,
Seasons primary; Approvals, Invites, Reconciliation, Audit in overflow.

## 1. Member onboarding

| Flow | Where | Behaviour |
|---|---|---|
| Create invite | `/admin/invites` → `POST /api/admin/invites` | Code with expiry + max uses for new member registration. |
| Revoke invite | `POST /api/admin/invites/[id]/revoke` | Invalidates remaining uses. |
| Approve / reject registration | `/admin/approvals` → `POST /api/admin/approve` / `reject` | New registrations land as `status = 'pending'`; approval flips to `active` (can sign in). |

## 2. Player management

| Flow | Where | Behaviour |
|---|---|---|
| View players / detail | `/admin/players`, `/admin/players/[id]` | Profile, attendance history. |
| Edit player | `PATCH /api/admin/players/[id]` | Name / phone corrections. |
| Block player | `POST /api/admin/players/[id]/block` | Sets `status = 'blocked'`. |
| Delete player | `DELETE /api/admin/players/[id]` | Removes the player row (attendance cascades); used e.g. to clean up trial guests. |
| Reset PIN | `POST /api/admin/players/[id]/reset-pin` | Issues a new login PIN. |

## 3. Season lifecycle

| Flow | Where | Behaviour |
|---|---|---|
| Create season | `/admin/seasons` → `POST /api/admin/seasons` | Date range, fees, court count, weekly schedule template. Auto-generates one `scheduled` session per matching weekday; capacity = `court_count × 6`. |
| Edit season | `/admin/seasons/[id]` → `PATCH /api/admin/seasons/[id]` | Safe fields cascade to all `scheduled` child sessions. Schedule edits that strand sessions trigger 409 + confirm; confirmed strands are `cancelled` + push notification. |
| Close season | `POST /api/admin/seasons/[id]/close` | Seals roster, cancels remaining `scheduled` sessions, pushes cancellation notification. |
| View subscribers | `/admin/seasons/[id]` | One row per subscriber with "N/M paid" aggregate (`listSeasonSubscribers`). |

## 4. Session management

| Flow | Where | Behaviour |
|---|---|---|
| Batch-add sessions | `/admin/seasons/[id]` (poll seasons only) → `POST /api/admin/sessions` | Ad-hoc dates; auto-creates subscription attendance rows for existing subscribers. |
| Edit session | `/admin/sessions/[id]` → `PATCH /api/admin/sessions/[id]` | Date, time, capacity, location, status, trial quota (cannot go below already-invited guest count) — independent of the season template. |
| Delete session | `DELETE /api/admin/sessions/[id]` | Cascade-removes attendance. |
| Set Tikkie link | `/admin/sessions/[id]` | Per-session payment URL (falls back to season override, then env default). |
| View participants | `/admin/sessions/[id]` | Attendees + waitlist, with source/RSVP/payment badges; cutoff + payment deadlines resolved before read. |

## 5. Payments & reconciliation

| Flow | Where | Behaviour |
|---|---|---|
| Flag / unflag payment | `/admin/reconciliation`, `/admin/sessions/[id]` → `POST /api/admin/payment/flag` | Toggles `assumed_paid` ↔ `flagged` per attendance row. Trust-first: flag only exceptions. |
| Reconciliation view | `/admin/reconciliation` | Next upcoming session's confirmed rows grouped by source. |

## 6. Cancel a player's booking

Admin-only cancellation on behalf of a player (design:
[suggestion/admin-cancel-booking-plan.md](./suggestion/admin-cancel-booking-plan.md)):

| Flow | Where | Behaviour |
|---|---|---|
| Cancel session booking | `/admin/sessions/[id]` (attendee + waitlist rows) → `POST /api/admin/bookings/cancel` | Row → `rsvp_status = 'cancelled'`; seat frees immediately (seat accounting is live) and the waitlist is promoted. Only for future `scheduled` sessions. |
| Cancel season subscription | `/admin/seasons/[id]` (subscriber rows) → `POST /api/admin/seasons/[id]/cancel-subscription` | Cancels the player's subscription rows in all *future scheduled* sessions; past/played sessions untouched. |
| Refund marker | automatic | Paid (`assumed_paid`) rows move to `refund_pending`; the refund settles personally outside the app. "Refund settled" (same endpoint as flag toggle) clears it back to `assumed_paid`. |
| Trial guests | same cancel button | Guest rows are deleted (account + booking, like the referrer revoke), freeing the phone's one-trial budget and a trial slot. |

Every cancellation is audit-logged (`admin_cancel_booking`,
`admin_cancel_season_subscription`) with actor, target player,
session/season, timestamp, and optional reason. Players cannot cancel their
own paid bookings — admin-only by design.

## 7. Audit

| Flow | Where | Behaviour |
|---|---|---|
| Review audit log | `/admin/audit` | Append-only trail: actor, action, entity, before/after JSON, timestamp. |
