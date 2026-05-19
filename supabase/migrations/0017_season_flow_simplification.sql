-- Season flow simplification.
--
-- Radically simplifies the season/session/subscription model:
--   * Drops the `subscriptions` table; subscription = attendance rows with
--     source='subscription'.
--   * Collapses season_status enum from {poll, booked, active, closed} to
--     {poll, closed}. Booked/active become poll (admin still owns the seasons).
--   * Collapses payment_status enum from
--     {n_a, owed, self_marked_paid, admin_confirmed} to {assumed_paid, flagged}.
--     Trust-first: every RSVP is assumed paid until admin flags it.
--   * Drops seasons.weekday and seasons.start_time — sessions are now created
--     explicitly via the batch day-picker.
--
-- Plan: plans/260518-2111-season-flow-simplification/
--
-- Postgres can't `ALTER TYPE ... DROP VALUE`, so enums use the
-- rename-and-recreate pattern (same approach as 0016).

-- ----------------------------------------------------------------------------
-- A) Migrate existing subscription attendance.
--    For every active subscription (opted_in | paid), ensure every session in
--    that season has an attendance row marking the player in.
-- ----------------------------------------------------------------------------

INSERT INTO attendance (session_id, player_id, source, rsvp_status, payment_status)
SELECT s.id, sub.player_id, 'subscription', 'in', 'admin_confirmed'
FROM subscriptions sub
JOIN sessions s ON s.season_id = sub.season_id
WHERE sub.status IN ('opted_in', 'paid')
ON CONFLICT (session_id, player_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- B) Normalize attendance.payment_status to the new value space before
--    recreating the enum. All legacy values fold into 'admin_confirmed'
--    (will become 'assumed_paid' after the enum swap below).
-- ----------------------------------------------------------------------------

UPDATE attendance
SET payment_status = 'admin_confirmed'
WHERE payment_status IN ('n_a', 'owed', 'self_marked_paid');

-- ----------------------------------------------------------------------------
-- C) Recreate payment_status enum: {assumed_paid, flagged}.
-- ----------------------------------------------------------------------------

ALTER TYPE payment_status RENAME TO payment_status_old;

CREATE TYPE payment_status AS ENUM ('assumed_paid', 'flagged');

ALTER TABLE attendance
  ALTER COLUMN payment_status DROP DEFAULT;

ALTER TABLE attendance
  ALTER COLUMN payment_status TYPE payment_status
  USING (
    CASE payment_status::text
      WHEN 'admin_confirmed' THEN 'assumed_paid'::payment_status
      ELSE 'flagged'::payment_status
    END
  );

ALTER TABLE attendance
  ALTER COLUMN payment_status SET DEFAULT 'assumed_paid';

DROP TYPE payment_status_old;

DROP INDEX IF EXISTS idx_attendance_payment;
CREATE INDEX idx_attendance_payment ON attendance(payment_status);

-- ----------------------------------------------------------------------------
-- D) Collapse season_status to {poll, closed}. Booked/active become poll so
--    the admin can still see and manage legacy seasons.
-- ----------------------------------------------------------------------------

UPDATE seasons
SET status = 'poll'
WHERE status IN ('booked', 'active');

ALTER TYPE season_status RENAME TO season_status_old;

CREATE TYPE season_status AS ENUM ('poll', 'closed');

ALTER TABLE seasons
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE seasons
  ALTER COLUMN status TYPE season_status
  USING status::text::season_status;

ALTER TABLE seasons
  ALTER COLUMN status SET DEFAULT 'poll';

DROP TYPE season_status_old;

-- ----------------------------------------------------------------------------
-- E) Drop seasons schedule fields that are no longer derived from the season —
--    sessions carry their own weekday_time + location.
-- ----------------------------------------------------------------------------

ALTER TABLE seasons
  DROP COLUMN IF EXISTS weekday,
  DROP COLUMN IF EXISTS start_time;

-- ----------------------------------------------------------------------------
-- F) Drop subscriptions table and its enum.
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS subscriptions;
DROP TYPE IF EXISTS subscription_status;
