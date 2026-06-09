-- Enforce idempotency of bunq webhook reconciliation at the DB layer.
--
-- The webhook checks for an existing bunq_payment_id before writing, but that
-- check-then-act is racy under bunq's callback retries (up to 6 attempts). A
-- partial UNIQUE index makes a duplicate write fail with 23505, which the
-- reconcile path catches and treats as a no-op "duplicate" outcome.
--
-- Partial (WHERE NOT NULL) so the many rows without a bunq payment id are
-- unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_bunq_payment_id_unique
  ON attendance (bunq_payment_id)
  WHERE bunq_payment_id IS NOT NULL;
