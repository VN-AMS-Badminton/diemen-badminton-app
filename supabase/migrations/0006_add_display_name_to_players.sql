-- Add human-readable display name separate from the login username.
-- Shown to admins so they know who the person is.
-- Default to username for existing rows.
ALTER TABLE players ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
UPDATE players SET display_name = username WHERE display_name = '';
