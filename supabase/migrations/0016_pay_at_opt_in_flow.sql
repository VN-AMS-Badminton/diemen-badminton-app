-- Pay-at-opt-in subscription flow.
--
-- 1) seasons gains schedule fields (weekday/start_time/location) used as the
--    estimate at poll-open and (optionally overridden) actual at book step.
--    Fees + court_count stay frozen from poll-open.
--
-- 2) subscription_status enum collapses from 4 values to 3:
--    opted_in | paid | cancelled  (drops `confirmed`).
--    Postgres can't `ALTER TYPE ... DROP VALUE`, so we rename-and-recreate
--    the type. Any legacy `confirmed` rows become `opted_in` (they were
--    booked into the season but unpaid — same meaning as opted_in going forward).
--
-- Plan: plans/260517-2246-pay-at-opt-in-subscription-flow/

-- ----------------------------------------------------------------------------
-- 1) Schedule columns on seasons
-- ----------------------------------------------------------------------------

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS weekday    int  CHECK (weekday BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS start_time text CHECK (start_time ~ '^[0-9]{2}:[0-9]{2}$'),
  ADD COLUMN IF NOT EXISTS location   text;

-- ----------------------------------------------------------------------------
-- 2) Collapse subscription_status enum: drop `confirmed`
-- ----------------------------------------------------------------------------

-- 2a) Rewrite any legacy 'confirmed' rows to 'opted_in' BEFORE the cast.
UPDATE subscriptions SET status = 'opted_in' WHERE status = 'confirmed';

-- 2b) Rename existing type out of the way.
ALTER TYPE subscription_status RENAME TO subscription_status_old;

-- 2c) Recreate the type with the new (smaller) value set.
CREATE TYPE subscription_status AS ENUM ('opted_in', 'paid', 'cancelled');

-- 2d) Re-point the column at the new type. Drop default first, retype, restore default.
ALTER TABLE subscriptions
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE subscriptions
  ALTER COLUMN status TYPE subscription_status
  USING status::text::subscription_status;

ALTER TABLE subscriptions
  ALTER COLUMN status SET DEFAULT 'opted_in';

-- 2e) Drop the old type now that nothing depends on it.
DROP TYPE subscription_status_old;
