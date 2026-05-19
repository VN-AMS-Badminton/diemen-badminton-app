-- Drop-in payment deadline (36h auto-drop).
--
-- When an attendance row enters (rsvp_status='in', payment_status='unpaid'),
-- payment_due_at is set to min(now + 36h, session.start_at). A lazy resolver
-- cancels rows whose deadline has passed and promotes the waitlist.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ;

-- Partial index: the resolver only scans unpaid rows with a deadline set.
CREATE INDEX IF NOT EXISTS idx_attendance_payment_due_at
  ON attendance(payment_due_at)
  WHERE payment_due_at IS NOT NULL AND payment_status = 'unpaid';
