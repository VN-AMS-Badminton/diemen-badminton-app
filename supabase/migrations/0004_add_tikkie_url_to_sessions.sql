-- Add per-session Tikkie payment URL.
-- Drop-in fees vary by session (a new Tikkie link is generated each week).
-- Lookup chain: session.tikkie_url → season.tikkie_url_override → env TIKKIE_DEFAULT_URL.
ALTER TABLE sessions ADD COLUMN tikkie_url TEXT;
