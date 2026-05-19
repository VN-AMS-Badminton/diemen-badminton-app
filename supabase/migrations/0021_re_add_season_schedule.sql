-- Re-add weekday + start_time to seasons.
--
-- Migration 0017 dropped these on the theory that sessions would always be
-- picked one-by-one in the batch creator. In practice the admin wants to
-- declare the season's regular schedule up front so the batch creator can
-- pre-populate time + a "select all {weekday}s" shortcut.

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS weekday    int  CHECK (weekday BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS start_time text CHECK (start_time ~ '^[0-9]{2}:[0-9]{2}$');
