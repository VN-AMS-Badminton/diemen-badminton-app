# TODO

Open follow-ups that have no implementation branch yet.

## Ticket A — block player self-cancel of paid bookings

**Gap.** A paid drop-in can still cancel their own booking. The
`drop_in_cancel` action in `src/app/api/me/rsvp/route.ts` has no payment
check, and the "Cancel RSVP" button in
`src/components/player/next-session-card.tsx` renders for drop-ins regardless
of payment status. On cancel the row goes to `rsvp_status = 'cancelled'` with
`payment_status` left at `assumed_paid` — the seat frees correctly, but
nothing records that the club now owes the player money: no `refund_pending`
marker, no audit entry. This silently bypasses the admin cancellation flow
(`feat/admin-cancel-booking`), which exists precisely to track that debt.

**Intended behaviour** (per the admin-cancel ticket's acceptance criteria:
"Regular players cannot cancel their own paid bookings; only admins can"):

- Unpaid drop-in → self-cancel stays free (no money involved).
- Paid drop-in → self-cancel blocked; the player either asks an admin
  (admin cancel → `refund_pending` → personal settlement) or uses the
  existing admin-free escape hatch: **pass the slot** to another player
  (peer-to-peer settlement, already gated on having paid).

**Sketch.**

1. Server: in `drop_in_cancel`, reject when `payment_status !== 'unpaid'`
   → 400 "Paid bookings can only be cancelled by an admin".
2. UI: in `next-session-card.tsx` state 4, hide the Cancel button for paid
   drop-ins and show a hint ("Paid — ask an admin to cancel, or pass your
   slot").
3. Decide: `waitlist_leave` for the rare paid-waitlisted row (admin pre-paid
   edge case, see promote-waitlist.ts) — block it too, or auto-mark the row
   `refund_pending` on leave.
