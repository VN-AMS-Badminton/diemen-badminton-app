-- Drop date + weekday_time; start_at becomes the single temporal column.
--
-- Migration 0013 added start_at NOT NULL (backfilling from date+weekday_time).
-- These two source columns are now fully redundant — everything that needed a
-- precise timestamp already uses start_at; display derivations move to app code.
--
-- Also cleans up a trigger-based draft that was never applied.

-- Defensive drop of draft trigger/function (no-op if this migration is the
-- first one to run since 0013).
DROP TRIGGER IF EXISTS trg_sessions_compute_start_at ON sessions;
DROP FUNCTION IF EXISTS compute_session_start_at();

-- Remove the table-level unique constraint on (season_id, date).
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_season_id_date_key;

-- Drop redundant columns.
ALTER TABLE sessions DROP COLUMN IF EXISTS weekday_time;
ALTER TABLE sessions DROP COLUMN IF EXISTS date;

-- Recreate the "one session per local calendar day per season" guarantee as a
-- functional unique index. AT TIME ZONE handles CET/CEST DST automatically.
-- The expression needs the extra outer parens — CREATE INDEX treats each
-- column slot as a single atom, and `(expr)::type` isn't one without wrapping.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_season_local_date_key
  ON sessions(season_id, (CAST(start_at AT TIME ZONE 'Europe/Amsterdam' AS date)));
