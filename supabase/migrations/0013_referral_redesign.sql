-- Referral system redesign: permanent codes, cap-based throughput,
-- tentative seats with cutoff lock-in, member-side waitlist.
--
-- Supersedes the invite-driven referral mechanic (0009/0010). The `invites`
-- table is retained for admin signup-invites only; referrals now live entirely
-- on `players.referral_code` + flagged `attendance` rows.
--
-- Plan: plans/260516-0112-referral-system-redesign/

-- 1) New columns ------------------------------------------------------------

-- Permanent opaque referral code per active member (nullable for non-members).
ALTER TABLE players ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS players_referral_code_key
  ON players(referral_code)
  WHERE referral_code IS NOT NULL;

-- Tentative/bumped flags on attendance. Decoupled from rsvp_status so cap
-- accounting and lock-in logic stay independent.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_tentative boolean NOT NULL DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS bumped_at    timestamptz;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS cap_consumed boolean NOT NULL DEFAULT false;

-- start_at: real timestamptz for cutoff queries. Backfilled below from
-- date + weekday_time. Cutoff resolution writes to cutoff_resolved_at.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS start_at           timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cutoff_resolved_at timestamptz;

-- 2) New enum value: rsvp_status += 'waitlisted'
-- Safe to ADD VALUE on Supabase (PG15+). Value not referenced in this migration body.
ALTER TYPE rsvp_status ADD VALUE IF NOT EXISTS 'waitlisted';

-- 3) Backfill sessions.start_at -------------------------------------------
-- weekday_time is free text (e.g. "Thu 19:00", "Wednesday 19:00", "19:00").
-- Regex out the first HH:MM, fall back to 19:00 (the club default).
-- Times stored UTC; the date+time is interpreted in Europe/Amsterdam.
DO $$
DECLARE
  r record;
  m text[];
  hh int;
  mm int;
BEGIN
  FOR r IN SELECT id, date, weekday_time FROM sessions WHERE start_at IS NULL LOOP
    m := regexp_match(r.weekday_time, '(\d{1,2}):(\d{2})');
    IF m IS NULL THEN
      hh := 19;
      mm := 0;
    ELSE
      hh := m[1]::int;
      mm := m[2]::int;
    END IF;
    UPDATE sessions
      SET start_at = ((r.date::text || ' '
                       || lpad(hh::text, 2, '0') || ':'
                       || lpad(mm::text, 2, '0') || ':00')::timestamp
                      AT TIME ZONE 'Europe/Amsterdam')
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE sessions ALTER COLUMN start_at SET NOT NULL;

-- 4) Backfill referral codes for active members ---------------------------
-- 12 random bytes -> url-safe base64 (no +/=). Retry on unique collision.
DO $$
DECLARE
  r record;
  candidate text;
  attempt int;
BEGIN
  FOR r IN SELECT id FROM players WHERE status = 'active' AND referral_code IS NULL LOOP
    FOR attempt IN 1..5 LOOP
      candidate := translate(encode(gen_random_bytes(12), 'base64'), '+/=', '-_');
      BEGIN
        UPDATE players SET referral_code = candidate
          WHERE id = r.id AND referral_code IS NULL;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- collision, retry
        NULL;
      END;
    END LOOP;
  END LOOP;
END $$;

-- 5) Partial index for cap query ------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_referrer_cap
  ON attendance(player_id, source, created_at)
  WHERE source = 'referral' AND cap_consumed = true;

-- Helpful index for cutoff resolver scanning sessions due for resolution.
CREATE INDEX IF NOT EXISTS idx_sessions_cutoff_pending
  ON sessions(start_at)
  WHERE cutoff_resolved_at IS NULL;

-- 6) RPC: resolve_session_cutoff ------------------------------------------
-- Atomic cutoff resolver. Lazy-called from app code on any session-touching
-- read; the FOR UPDATE lock prevents concurrent resolvers from double-firing.
--
-- Behavior:
--   no-op if pre-cutoff (now < start_at - 24h) OR already resolved.
--   else:
--     N = min(waitlist count, tentative count)
--     promote oldest N waitlisted -> 'in'
--     bump oldest N tentative guests (set bumped_at; cap-restore if same month)
--     survivors (tentative remainder): is_tentative=false, free_trial_used=true
--     set cutoff_resolved_at = now()
CREATE OR REPLACE FUNCTION resolve_session_cutoff(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_at        timestamptz;
  v_resolved        timestamptz;
  v_now             timestamptz := now();
  v_waitlist_ids    uuid[];
  v_tentative_ids   uuid[];
  v_to_promote      uuid[];
  v_to_bump         uuid[];
  v_to_lock         uuid[];
  v_n               int;
BEGIN
  SELECT start_at, cutoff_resolved_at
    INTO v_start_at, v_resolved
    FROM sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_resolved IS NOT NULL THEN RETURN; END IF;
  IF v_start_at - interval '24 hours' > v_now THEN RETURN; END IF;

  SELECT COALESCE(array_agg(id ORDER BY created_at ASC), ARRAY[]::uuid[])
    INTO v_waitlist_ids
    FROM attendance
    WHERE session_id = p_session_id
      AND rsvp_status = 'waitlisted';

  SELECT COALESCE(array_agg(id ORDER BY created_at ASC), ARRAY[]::uuid[])
    INTO v_tentative_ids
    FROM attendance
    WHERE session_id = p_session_id
      AND rsvp_status = 'in'
      AND is_tentative = true
      AND bumped_at IS NULL;

  v_n := LEAST(COALESCE(array_length(v_waitlist_ids, 1), 0),
               COALESCE(array_length(v_tentative_ids, 1), 0));

  IF v_n > 0 THEN
    v_to_promote := v_waitlist_ids[1:v_n];
    v_to_bump    := v_tentative_ids[1:v_n];

    UPDATE attendance
      SET rsvp_status = 'in'
      WHERE id = ANY(v_to_promote);

    -- Same-month bump restores cap; cross-month keeps it consumed (no bonus slot next month).
    UPDATE attendance a
      SET bumped_at    = v_now,
          cap_consumed = CASE
            WHEN date_trunc('month', a.created_at AT TIME ZONE 'Europe/Amsterdam')
               = date_trunc('month', v_now         AT TIME ZONE 'Europe/Amsterdam')
            THEN false
            ELSE true
          END
      WHERE id = ANY(v_to_bump);

    INSERT INTO audit_log(actor_id, action, entity, entity_id, before_json, after_json)
      SELECT NULL, 'cutoff_promote_waitlist', 'attendance', x::text,
             NULL, jsonb_build_object('session_id', p_session_id)
        FROM unnest(v_to_promote) AS x;

    INSERT INTO audit_log(actor_id, action, entity, entity_id, before_json, after_json)
      SELECT NULL, 'cutoff_bump_tentative', 'attendance', x::text,
             NULL, jsonb_build_object('session_id', p_session_id)
        FROM unnest(v_to_bump) AS x;
  END IF;

  IF COALESCE(array_length(v_tentative_ids, 1), 0) > v_n THEN
    v_to_lock := v_tentative_ids[(v_n + 1):array_length(v_tentative_ids, 1)];

    UPDATE attendance
      SET is_tentative = false
      WHERE id = ANY(v_to_lock);

    UPDATE players p
      SET free_trial_used = true
      WHERE p.id IN (SELECT player_id FROM attendance WHERE id = ANY(v_to_lock));

    INSERT INTO audit_log(actor_id, action, entity, entity_id, before_json, after_json)
      SELECT NULL, 'cutoff_lock_in_tentative', 'attendance', x::text,
             NULL, jsonb_build_object('session_id', p_session_id)
        FROM unnest(v_to_lock) AS x;
  END IF;

  UPDATE sessions SET cutoff_resolved_at = v_now WHERE id = p_session_id;
END;
$$;

-- Restrict RPC execution to authenticated roles; anon should not poke at it.
REVOKE ALL ON FUNCTION resolve_session_cutoff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_session_cutoff(uuid) TO authenticated, service_role;

-- 7) Legacy cleanup -------------------------------------------------------
-- target_player_id wired pending referral guests to invite codes. The new
-- referral model creates guests inline via /refer/<code>; no invite row is
-- involved, so the column has no readers left in the codebase.
DROP INDEX IF EXISTS idx_invites_target_player;
ALTER TABLE invites DROP COLUMN IF EXISTS target_player_id;

