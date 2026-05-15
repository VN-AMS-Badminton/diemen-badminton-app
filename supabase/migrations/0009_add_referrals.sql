-- Referrals: an active player can invite a non-member to attend one session
-- for free. The first RSVP after activation consumes the trial; subsequent
-- sessions follow standard drop-in fee logic.
--
-- Design notes:
--   * The referred guest is created as a real `players` row with status='pending'
--     so existing FKs in `attendance`, `audit_log`, etc. work unchanged.
--   * `pin_hash` is made nullable: a pending referral has no PIN until the
--     guest activates by clicking their invite link and setting one.
--   * `invites.target_player_id` ties a single-use invite code to that
--     pending player so registration activates them in place instead of
--     creating a new row.
--   * `attendance_source` gains 'referral' so admin UIs can flag the free
--     first session distinctly from regular drop-ins.

-- Allow pending referral players to exist without a PIN until activation.
ALTER TABLE players ALTER COLUMN pin_hash DROP NOT NULL;

-- Track who referred a player and whether their one free trial has been used.
ALTER TABLE players
  ADD COLUMN referred_by      uuid REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN free_trial_used  boolean NOT NULL DEFAULT false;

CREATE INDEX idx_players_referred_by ON players(referred_by);

-- Link an invite to a specific pre-created (pending) player so that
-- registering with this code activates that player rather than inserting new.
ALTER TABLE invites
  ADD COLUMN target_player_id uuid REFERENCES players(id) ON DELETE CASCADE;

CREATE INDEX idx_invites_target_player ON invites(target_player_id);

-- Distinguish the first free session of a referred guest from regular drop-ins.
ALTER TYPE attendance_source ADD VALUE IF NOT EXISTS 'referral';
