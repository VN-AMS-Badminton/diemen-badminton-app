-- Add optional free-text location to sessions.
-- Each session can specify its own venue label (e.g. "Sporthal Diemen — Court 2").
-- NULL = no location set.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS location text;
