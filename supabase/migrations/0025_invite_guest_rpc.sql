-- Single-round-trip guest trial invite RPC.
--
-- Replaces 4 sequential network calls in inviteGuest() (session fetch, two
-- COUNT queries in parallel, player INSERT, attendance INSERT) with one atomic
-- DB function call. All queries execute locally in Postgres — zero extra
-- network round trips between them.
--
-- The caller (invite-guest.ts) pre-generates the guest username using Node
-- crypto.randomBytes so we don't need to replicate that logic in PL/pgSQL.
--
-- Return shape — the function always succeeds at the RPC protocol level:
--   { ok: true,  playerId: uuid, attendanceId: uuid }   happy path
--   { ok: false, error: "..." }                         any guard or insert failure

CREATE OR REPLACE FUNCTION public.invite_guest_trial(
  p_session_id  uuid,
  p_referrer_id uuid,
  p_guest_name  text,
  p_phone       text,
  p_username    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sess       RECORD;
  v_trial_used bigint;
  v_in_count   bigint;
  v_player_id  uuid;
  v_att_id     uuid;
BEGIN
  -- 1. Fetch and validate session.
  SELECT id, capacity, status, start_at, trial_quota
    INTO v_sess
    FROM public.sessions
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session not found');
  END IF;
  IF v_sess.status::text != 'scheduled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session is no longer open');
  END IF;
  IF v_sess.start_at <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session has already passed');
  END IF;

  -- 2. Trial quota (idx_attendance_trial_count from 0024 covers this scan).
  SELECT COUNT(*) INTO v_trial_used
    FROM public.attendance
   WHERE session_id  = p_session_id
     AND source      = 'referral'::public.attendance_source
     AND rsvp_status = 'in'::public.rsvp_status;

  IF v_trial_used >= v_sess.trial_quota THEN
    RETURN jsonb_build_object('ok', false, 'error', 'All trial slots for this session are taken');
  END IF;

  -- 3. Capacity check.
  SELECT COUNT(*) INTO v_in_count
    FROM public.attendance
   WHERE session_id  = p_session_id
     AND rsvp_status = 'in'::public.rsvp_status
     AND bumped_at IS NULL;

  IF v_in_count >= v_sess.capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session is full');
  END IF;

  -- 4. Insert guest player.
  --    unique_violation (23505) = this phone already used for a free trial.
  --    The inner BEGIN/EXCEPTION establishes a savepoint; on unique_violation
  --    it rolls back only the failed INSERT and returns early.
  BEGIN
    INSERT INTO public.players
      (username, display_name, whatsapp_number, pin_hash,
       role,                          status,                         referred_by,  free_trial_used)
    VALUES
      (p_username, p_guest_name, p_phone, NULL,
       'player'::public.player_role, 'active'::public.player_status, p_referrer_id, true)
    RETURNING id INTO v_player_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'This phone number has already been used for a free trial'
    );
  END;

  -- 5. Insert attendance.
  --    Any failure here propagates to the outer EXCEPTION block which rolls
  --    back everything in this invocation — including the player INSERT above.
  INSERT INTO public.attendance
    (session_id,   player_id,   source,                               rsvp_status,
     payment_status,                    is_tentative, cap_consumed)
  VALUES
    (p_session_id, v_player_id, 'referral'::public.attendance_source, 'in'::public.rsvp_status,
     'assumed_paid'::public.payment_status, false,        false)
  RETURNING id INTO v_att_id;

  RETURN jsonb_build_object(
    'ok',           true,
    'playerId',     v_player_id::text,
    'attendanceId', v_att_id::text
  );

EXCEPTION WHEN OTHERS THEN
  -- Catches any unhandled error (e.g. attendance insert failure).
  -- PL/pgSQL rolls back to the savepoint at the top of this block,
  -- discarding both the player and attendance inserts before returning.
  RETURN jsonb_build_object('ok', false, 'error', 'Could not RSVP guest to session');
END;
$$;

REVOKE ALL     ON FUNCTION public.invite_guest_trial(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invite_guest_trial(uuid, uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_guest_trial(uuid, uuid, text, text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.invite_guest_trial(uuid, uuid, text, text, text) TO   service_role;
