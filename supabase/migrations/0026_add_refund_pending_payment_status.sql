-- Admin booking cancellation (docs/suggestion/admin-cancel-booking-plan.md).
--
-- 'refund_pending' marks attendance rows whose player had (assumed) paid
-- before an admin cancelled the booking on their behalf. The refund itself
-- settles personally outside the app — this value is only a reconciliation
-- marker. Admin clears it back to 'assumed_paid' once settled.
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending';
