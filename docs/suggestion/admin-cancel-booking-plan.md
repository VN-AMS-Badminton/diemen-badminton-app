# Plan: [Admin] Cancel a player's booking for a session or season

Status: proposed · Branch: `feat/admin-cancel-booking` (based on `main` incl. the guest-trial merge (#20); migration numbering continues from its `0025`)
Context docs: [admin-flow.md](../admin-flow.md), [player-flow.md](../player-flow.md), [glossary.md](../glossary.md), [database-schema.md](../database-schema.md)

## Ticket

Admin cancels a player's booking (single session or whole season subscription)
on their behalf. Only admins can cancel. Slot frees immediately; paid rows get
a refund-pending flag; everything audit-logged with optional reason.

## How the ticket maps onto the existing model

Facts that shape the design (all verified in code):

1. **There is no subscription table.** A "season subscription" = the player's
   `source = 'subscription'` attendance rows across the season's sessions
   (migration `0017`). So "subscription status set to cancelled" = setting
   `rsvp_status = 'cancelled'` on those rows.
2. **Slot count is live, not stored.** Seats taken = rows with
   `rsvp_status = 'in'` AND `bumped_at IS NULL`
   (`src/lib/waitlist/promote-waitlist.ts`, RSVP route). Flipping a row to
   `cancelled` frees the seat with zero extra bookkeeping. "Immediately
   freeing it" additionally means promoting the waitlist, same as the player
   self-cancel paths do.
3. **`cancelled` already has the right semantics**: generic drop, cannot
   self-rejoin as subscriber (`opt_in` requires `opted_out`), but drop-in
   re-booking stays possible. No new rsvp_status needed.
4. **Payment flagging**: `payment_status` enum is `assumed_paid | flagged |
   unpaid`. The ticket wants "refund-pending state or left as-is with a
   note". Reusing `flagged` would conflate "didn't pay" with "club owes a
   refund" in reconciliation views → add a 4th enum value `refund_pending`.
5. **Audit + reason**: `writeAudit(actor, action, entity, entityId, before,
   after)` exists; reason rides inside `after_json`.
6. **"Regular players cannot cancel their own paid bookings" (Ticket A)** is a
   separate ticket. Today `drop_in_cancel` in `/api/me/rsvp` allows paid
   self-cancel. This plan does not change player routes; noted as dependency.

## Implementation steps

### 1. Migration `0026_add_refund_pending_payment_status.sql`

(`0024`/`0025` are taken by the `guest-trial` branch.)

```sql
alter type payment_status add value if not exists 'refund_pending';
```

Update `src/lib/db/types.ts`: `PaymentStatus` union + enum map.

### 2. Business logic: `src/lib/admin/cancel-booking.ts`

Injectable-`sb` style like `src/lib/sessions/pass-slot.ts` so it unit-tests
with the existing Proxy mock pattern.

`cancelBooking({ sb, actorId, attendanceId, reason })`:

1. Load attendance row (404 if missing) + its session.
2. Guards: session `status = 'scheduled'` and `start_at` in the future;
   row `rsvp_status` ∈ {`in`, `waitlisted`} (400 otherwise — `passed` rows
   belong to the receiver now, `cancelled`/`opted_out` are no-ops).
3. Payment transition: `assumed_paid` → `refund_pending`; `unpaid`/`flagged`
   unchanged (unpaid never paid; flagged is already an admin dispute).
4. Update row: `rsvp_status = 'cancelled'`, payment status per (3),
   `marked_by = actorId`.
5. If previous status was `in`: `promoteWaitlist(sessionId)` (waitlisted rows
   held no seat — skip).
6. `writeAudit(actorId, 'admin_cancel_booking', 'attendance', id, before,
   { ...after, reason })` — covers actor, target player (in row), session
   (in row), timestamp, reason.

`cancelSeasonSubscription({ sb, actorId, seasonId, playerId, reason })`:

1. Load season (404 if missing).
2. Select the player's `source = 'subscription'` rows in this season's
   sessions where session `status = 'scheduled'` AND `start_at > now()` and
   `rsvp_status` ∈ {`in`, `opted_out`} — past/`done` sessions stay untouched
   (played; payment history preserved).
3. Per row: same transition as `cancelBooking` steps 3–4; collect session ids
   whose row was `in`.
4. `promoteWaitlist()` once per affected session.
5. One summary audit row: `writeAudit(actorId,
   'admin_cancel_season_subscription', 'season', seasonId, null,
   { player_id, cancelled_attendance_ids, reason })`.
6. Return count of cancelled sessions (for UI toast/dialog).

### 3. API routes (pattern: `/api/admin/payment/flag`)

- `POST /api/admin/bookings/cancel` — body `{ attendanceId: uuid, reason?:
  string (≤500) }`. `requireAdmin()`; run `resolveCutoffIfDue` +
  `resolvePaymentDeadlines` for the session first; delegate to
  `cancelBooking`.
- `POST /api/admin/seasons/[id]/cancel-subscription` — body `{ playerId:
  uuid, reason?: string }`. `requireAdmin()`; delegate to
  `cancelSeasonSubscription`.

### 4. UI

- `src/components/admin/cancel-booking-dialog.tsx` — client component:
  AlertDialog with optional reason `<textarea>` + destructive confirm
  (`ConfirmActionButton` doesn't support inputs, so a small bespoke dialog
  mirroring its structure). Props: `title`, `description`, `onConfirm(reason)`.
- **Session participant list** (`src/app/admin/sessions/[id]/page.tsx`):
  "Cancel booking" per row with `rsvp_status` ∈ {`in`, `waitlisted`} and a
  future `scheduled` session — both mobile card and desktop table views.
  Also add waitlist-row actions (waitlist table currently has none).
- **Season subscriber list** (`src/app/admin/seasons/[id]/page.tsx`): add
  Actions column with "Cancel subscription" per subscriber; dialog
  description states how many upcoming sessions will be cancelled (computable
  from the already-loaded sessions + a per-player upcoming count from
  `listSeasonSubscribers` — extend `SubscriberSummary` with
  `upcomingSessions`).
- **`refund_pending` badge** everywhere `payment_status` renders:
  admin session detail, `/admin/reconciliation`, player payment views
  (`payment-block.tsx`, dashboard) — render as e.g. amber "refund pending".

### 5. Tests (`src/lib/admin/__tests__/cancel-booking.test.ts`)

Proxy-mock pattern from `pass-slot.test.ts`:

- cancel `in` subscriber → row cancelled, `refund_pending`, waitlist promoted.
- cancel unpaid drop-in → stays `unpaid`, no refund flag.
- cancel `waitlisted` row → cancelled, **no** promote call.
- already `cancelled` / `passed` row → 400.
- past or non-scheduled session → 400.
- season cancel: only future scheduled sessions affected; `opted_out` rows
  also cancelled; summary audit row written; per-session promotion.

### 6. Doc updates (same PR as implementation)

- `database-schema.md`: enum table + design note for `refund_pending`.
- `admin-flow.md` §6: flip from "planned" to implemented, fill in routes.
- `player-flow.md` §7 stays accurate as-is.

## Edge cases

- **Trial guest rows (`source = 'referral'`, from guest-trial's in-app
  invites)**: flipping one to `cancelled` frees both the seat AND a trial
  slot automatically — `trial_quota` usage is a live count of
  `source='referral' AND rsvp_status='in'` rows. But it leaves the guest
  player row behind with `free_trial_used = true`, permanently consuming
  that phone number's one trial. Recommendation: for guest rows, admin
  cancel should instead mirror the referrer revoke
  (`DELETE /api/me/guests/[guestId]` semantics: delete guest player,
  attendance cascades, phone freed) — branch inside `cancelBooking` or
  reject guest rows with a hint to use player deletion
  (`DELETE /api/admin/players/[id]`, already on guest-trial). Decide in
  review (unresolved Q5).
- **Legacy tentative guests** (`is_tentative`/`bumped_at` from the retired
  referral-code flow): bumped rows hold no seat; cancel allowed, promotion
  harmless (promoteWaitlist recounts from scratch). New in-app guests are
  never tentative.
- **Race with concurrent player RSVP**: same exposure as existing cancel
  paths; promoteWaitlist recount keeps capacity consistent. Acceptable at
  club scale.
- **Player re-books after admin cancel**: possible via drop-in (existing row
  is reused and flipped to `drop_in`/`unpaid`). Intended — admin cancel is
  not a ban.
- **Season with zero future sessions**: season-cancel returns count 0; UI
  shows "nothing to cancel" rather than an error.

## Out of scope

- Ticket A (blocking player self-cancel of paid bookings) — player routes
  untouched here.
- Actual refund execution — out-of-band (Tikkie/bank); `refund_pending` is
  only a reconciliation marker. Admin clears it via existing flag toggle
  (extend toggle to reset `refund_pending` → `assumed_paid`).
- Push notification to the cancelled player — recommended follow-up
  (`sendPushToPlayers` exists), not in acceptance criteria.

## Unresolved questions

1. **Ticket A ordering** — land before or after this? Until it lands, a paid
   drop-in can still self-cancel via `drop_in_cancel` (no refund flag), which
   bypasses the "only admins cancel paid bookings" rule.
2. **`refund_pending` vs reuse `flagged`** — plan assumes new enum value;
   confirm before migration.
3. **Notify the player on admin cancel?** Push notification is one line of
   reuse but changes UX expectations; default = no (not in AC).
4. **Season-cancel scope** — plan cancels only *future scheduled* sessions and
   leaves past/done rows for payment history. Confirm that matches refund
   expectations (refund only future sessions).
5. **Trial guest rows** — generic cancel (keeps guest account, phone stays
   consumed) vs guest-player deletion (frees phone, like referrer revoke)?
   Plan recommends deletion semantics for `source = 'referral'` rows.
