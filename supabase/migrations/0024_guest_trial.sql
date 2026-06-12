-- Guest / trial player invitation.
--
-- 1. sessions.trial_quota   — per-session cap on guest trial slots (default 4)
-- 2. Unique partial index   — whatsapp_number is the phone field; enforce that
--                             the same number can only claim one free trial
--                             across all sessions
-- Guest players are identified by referred_by IS NOT NULL (existing column).
-- No new attendance_source value needed; in-app invites reuse source='referral'.

-- 1. Trial quota on sessions --------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS trial_quota int NOT NULL DEFAULT 4;

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_trial_quota_non_negative;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_trial_quota_non_negative CHECK (trial_quota >= 0);

-- 2. One free trial per whatsapp_number ---------------------------------------
-- Scoped to rows where free_trial_used = true so regular members are unaffected.
DROP INDEX IF EXISTS players_trial_whatsapp_unique;
CREATE UNIQUE INDEX players_trial_whatsapp_unique
  ON players (whatsapp_number)
  WHERE free_trial_used = true AND whatsapp_number IS NOT NULL;

-- 3. Partial index for the per-session trial count query ---------------------
-- Covers: getNextSession (every dashboard load) and inviteGuest (every invite).
-- Without this, both queries do a heap scan over the session's attendance rows.
CREATE INDEX IF NOT EXISTS idx_attendance_trial_count
  ON attendance (session_id)
  WHERE source = 'referral' AND rsvp_status = 'in';
