# Glossary

Project-specific terms used in code, docs, and tickets. When a ticket says
"booking" or "subscription status", map it to these concepts first — several
terms are overloaded (e.g. there is **no** `subscriptions` table; a
subscription is a set of attendance rows).

## Core entities

| Term | Meaning |
|---|---|
| **Season** | An explicit date range (`from_date` → `to_date`), usually one calendar month. Carries fees, default venue, and a weekly schedule template used to auto-generate sessions. Status: `poll` (open for sign-up) → `closed` (roster sealed). |
| **Poll** | The sign-up window of a season (`poll_opens_at` → `poll_closes_at`, while status is `poll`). Players subscribe/unsubscribe freely during the poll; admin closes the season to seal it. |
| **Session** | One playing evening belonging to a season. Auto-generated from the season schedule, then independently editable (date, time, capacity, venue, status). Status: `scheduled` / `done` / `cancelled`. Default capacity = `court_count × 6`. |
| **Attendance row** | The central booking record: one player × one session. Holds `source`, `rsvp_status`, `payment_status`, payment deadline, referral flags. Every booking concept below is an attendance row. |
| **Booking** | Informal term (tickets, UI copy) for an attendance row with `rsvp_status = 'in'` or `'waitlisted'`. |

## Booking types (`attendance.source`)

| Term | Meaning |
|---|---|
| **Subscription / subscriber** | Player opted into the season poll. One attendance row per season session with `source = 'subscription'`, `rsvp_status = 'in'`, `payment_status = 'assumed_paid'`. "Season subscription status" = the aggregate of these rows; there is no separate table (dropped in migration `0017`). |
| **Drop-in** | Pay-per-session booking (`source = 'drop_in'`). Starts `unpaid` with a `payment_due_at` deadline (36h self-confirm clock); expired unpaid drop-ins are auto-cancelled. |
| **Passed slot** | Receiver side of a slot pass: new row with `source = 'passed'`, `payment_status = 'assumed_paid'` (payment settled peer-to-peer). |
| **Referral guest (trial guest)** | Guest invited **in-app** by a member (name + phone, `POST /api/me/sessions/[id]/invite-guest` → `invite_guest_trial` RPC). Gets a login-less player account (`pin_hash = NULL`, `referred_by` set, `free_trial_used = true` immediately) and one `source = 'referral'`, `assumed_paid` attendance row. One free trial per phone number, ever (unique partial index). |
| **Trial quota** | Per-session cap on trial guests (`sessions.trial_quota`, default 4, admin-editable). Live count: rows with `source = 'referral'` AND `rsvp_status = 'in'`. |
| **Guest revoke** | The referrer deletes their guest before the session starts (`DELETE /api/me/guests/[guestId]`). Hard-deletes the guest player row (attendance cascades), freeing the phone number for a fresh invite; waitlist is promoted. |

## RSVP statuses (`attendance.rsvp_status`)

| Value | Meaning |
|---|---|
| `in` | Confirmed; consumes a seat (unless `bumped_at` is set). |
| `opted_out` | Subscriber opted out of this one session. Reversible (can opt back in if a seat is free). |
| `waitlisted` | Waiting for a freed seat, FIFO by `created_at`. |
| `cancelled` | Generic cancel: drop-in left, player left waitlist, admin cancelled. A cancelled subscriber cannot self-rejoin as subscriber (only `opted_out` can); they can re-book as drop-in. |
| `passed` | Permanently gave the slot to another player. Irreversible; blocks re-RSVP. |

## Payments

| Term | Meaning |
|---|---|
| **Trust-first** | Default model: rows start `assumed_paid`; admin only flags exceptions. Payment happens out-of-band via Tikkie. |
| **Tikkie** | Personal payment-request link (per session, with season-level override and env default). Honor system in v1; Bunq webhook auto-confirmation is future work. |
| `assumed_paid` | Default. Player is trusted to have paid / will pay. |
| `unpaid` | Drop-in that hasn't self-confirmed payment yet; subject to `payment_due_at` auto-cancel. |
| `flagged` | Admin marked the row as a payment anomaly (e.g. no-show without paying). Toggled on the reconciliation/session screens. |
| `refund_pending` | Player had (assumed) paid when an admin cancelled their booking. The refund settles personally outside the app; admin clears the marker ("Refund settled") once done. |

## Capacity & lifecycle

| Term | Meaning |
|---|---|
| **Seat accounting** | Seats taken = count of attendance rows with `rsvp_status = 'in'` AND `bumped_at IS NULL`. There is no stored counter — flipping a row to any other status immediately frees the seat. |
| **Waitlist promotion** | When a seat frees, the oldest `waitlisted` row is promoted to `in` (`promoteWaitlist`); unpaid promotees get a fresh payment deadline. |
| **Cutoff / resolver** | `resolve_session_cutoff(uuid)`: idempotent Postgres RPC run lazily before attendance reads/writes. Promotes waitlist, cancels expired unpaid drop-ins, sets `cutoff_resolved_at`. (Also bumps `is_tentative` guests — legacy from the retired referral-code flow; in-app invited guests are never tentative.) |
| **Slot pass** | Member permanently transfers their seat to an eligible player. Passer → `rsvp_status = 'passed'`; receiver gets a new `source = 'passed'` row. |

## People & access

| Term | Meaning |
|---|---|
| **Player** | Any account (`players` table). Role `player` or `admin`. Status `pending` (awaiting approval) / `active` / `blocked`. Trial guests are also players — identified by `referred_by IS NOT NULL`, no PIN, created `active`. |
| **Admin** | Role with access to `/admin/*` (middleware-gated) and `/api/admin/*` (`requireAdmin`). Manages seasons, sessions, payments, approvals, invites. |
| **Invite** | Admin-issued registration code for new full members (code, expiry, max uses). Distinct from a guest invite. |
| **Audit log** | Append-only `audit_log` table: actor, action, entity, before/after JSON. Written for admin mutations and system actions (e.g. waitlist promotion). |
