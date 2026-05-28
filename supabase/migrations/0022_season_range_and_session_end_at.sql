-- Season range + session end timestamp.
--
-- Goals:
--   1. Support multi-month seasons (or any custom date range) via explicit
--      from_date / to_date columns. `year_month` is kept as a display label
--      and is now derived from `from_date` on insert/update from the API
--      layer — we do not enforce a single-month range at the DB level.
--   2. Persist a real end timestamp per session so duration can be surfaced
--      and admins can edit slot length. Default backfill = start_at + 2h30m
--      which matches the Diemen club's actual slot length.
--
-- Idempotent: every ALTER uses IF NOT EXISTS / safe-default pattern so a
-- partial re-run will not break.

-- 1. seasons.from_date / to_date ---------------------------------------------
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS from_date date,
  ADD COLUMN IF NOT EXISTS to_date   date;

-- Backfill from year_month: first-of-month → last-of-month.
UPDATE seasons
SET
  from_date = COALESCE(from_date, (year_month || '-01')::date),
  to_date   = COALESCE(
    to_date,
    (date_trunc('month', (year_month || '-01')::date) + interval '1 month - 1 day')::date
  )
WHERE from_date IS NULL OR to_date IS NULL;

ALTER TABLE seasons
  ALTER COLUMN from_date SET NOT NULL,
  ALTER COLUMN to_date   SET NOT NULL;

-- to_date must not precede from_date.
ALTER TABLE seasons
  DROP CONSTRAINT IF EXISTS seasons_to_date_after_from_date;
ALTER TABLE seasons
  ADD CONSTRAINT seasons_to_date_after_from_date CHECK (to_date >= from_date);

-- 2. seasons.end_time --------------------------------------------------------
-- Mirrors the existing `start_time` schedule default. Used by both the
-- auto-gen step on season creation and the manual batch session creator.
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS end_time text;

ALTER TABLE seasons
  DROP CONSTRAINT IF EXISTS seasons_end_time_format;
ALTER TABLE seasons
  ADD CONSTRAINT seasons_end_time_format CHECK (
    end_time IS NULL OR end_time ~ '^[0-9]{2}:[0-9]{2}$'
  );

-- 3. sessions.end_at ---------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS end_at timestamptz;

-- Backfill: 2h30m after start_at (confirmed club slot length).
UPDATE sessions
SET end_at = start_at + interval '2 hours 30 minutes'
WHERE end_at IS NULL;

-- Keep end_at nullable defensively for now — the app sets it on every new
-- session, and we'd rather not block an old reseeded DB on a hard NOT NULL.
-- We still constrain it to be strictly after start_at when present.
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_end_at_after_start_at;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_end_at_after_start_at CHECK (end_at IS NULL OR end_at > start_at);
