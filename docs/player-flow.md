# Player (User) Flow

What a regular player can do and where. Terms: see [glossary.md](./glossary.md).

Players authenticate with username + 6-digit PIN (cookie session, `SESSION_SECRET`).
All data access is server-side (`service_role`); RLS is deny-all for browsers.

## 1. Joining the club

| Flow | Where | Behaviour |
|---|---|---|
| Register | `/register` → `POST /api/auth/register` | Requires an admin-issued invite code. Account lands as `pending` until admin approval. |
| Login / logout | `/` → `POST /api/auth/login`, `/api/auth/logout` | Username + PIN; rate-limited. |
| Change PIN | `/profile` → `POST /api/me/change-pin` | Self-service. |
| Push notifications | `/profile` (toggle) | Web-push subscription for cancellations, promotions, etc. |

## 2. Season poll (monthly subscription)

While a season is in `poll` status and the poll window is open:

| Flow | Where | Behaviour |
|---|---|---|
| Subscribe | Dashboard poll card → `POST /api/me/season/[id]/subscribe` | Creates one attendance row per scheduled session (`source = 'subscription'`, `rsvp_status = 'in'`, `assumed_paid`). |
| Unsubscribe (during poll) | `DELETE /api/me/season/[id]/subscribe` | Deletes the player's subscription rows. **Only while the poll is open** — after close, subscribers are committed; only an admin can cancel (see admin flow §6). |

After the poll closes, the roster is sealed; sessions added later by admin
auto-include existing subscribers.

## 3. Weekly RSVP (per session)

`POST /api/me/rsvp` with an action; cutoff + payment deadlines are resolved
before every read/write so capacity is accurate.

| Action | Who | Behaviour |
|---|---|---|
| `opt_out` | Subscriber | Sets row to `opted_out`; seat frees; oldest waitlisted player promoted. Reversible. |
| `opt_in` | Subscriber (previously opted out) | Back to `in` if a seat is free, else 409. |
| `drop_in_rsvp` | Anyone active | If a seat is free: `in` + `unpaid` + 36h `payment_due_at`. If full: joins waitlist. |
| `drop_in_cancel` | Drop-in | Sets row to `cancelled`; waitlist promoted. *Currently allowed regardless of payment status — restricting paid self-cancel is a separate ticket (admin-only cancellation).* |
| `waitlist_leave` | Waitlisted player | Sets row to `cancelled`. |

Waitlist promotion is FIFO; promoted unpaid players get a fresh payment deadline.

## 4. Payments (honor system)

| Flow | Where | Behaviour |
|---|---|---|
| Pay | Tikkie link on the session card | Out-of-band payment to the organizer's personal Tikkie. |
| Self-confirm | `POST /api/me/mark-paid` | Drop-in taps "I paid" → row leaves `unpaid` (trust-first; admin flags anomalies later). Unpaid drop-ins past the deadline are auto-cancelled. |

## 5. Slot passing

A subscriber or **paid** drop-in can permanently give their seat to another
eligible player (`/api/me/rsvp/pass`, recipients from
`/api/me/rsvp/eligible-recipients`). Passer's row → `passed` (irreversible,
blocks re-RSVP); receiver gets a new `source = 'passed'`, `assumed_paid` row.
Payment between players is settled privately.

## 6. Bring a guest (free trial)

Members invite guests **in-app** — there is no public referral link.

| Flow | Where | Behaviour |
|---|---|---|
| Invite guest | Session card dialog → `POST /api/me/sessions/[id]/invite-guest` | Member enters guest name + phone. Atomic RPC (`invite_guest_trial`) checks session is scheduled/future, trial quota (`sessions.trial_quota`, default 4), and capacity, then creates a login-less guest account (`free_trial_used = true`) + `source = 'referral'`, `assumed_paid` booking. |
| One trial per phone | enforced by DB | A phone number can claim exactly one free trial, ever (unique partial index). |
| Revoke guest | session card → `DELETE /api/me/guests/[guestId]` | Referrer-only, before session start. Hard-deletes the guest account (booking cascades), freeing the phone for a fresh invite; waitlist promoted. |

## 7. What players can NOT do

- Cancel a **paid** booking after the poll closes / once committed — only an
  admin can cancel on their behalf (with refund handled out-of-band). See
  [admin-flow.md §6](./admin-flow.md).
- Reclaim a `passed` slot, or re-join as subscriber after a `cancelled`
  subscription row (drop-in re-booking still possible).
- See or modify other players' data — no client-side DB access at all.
