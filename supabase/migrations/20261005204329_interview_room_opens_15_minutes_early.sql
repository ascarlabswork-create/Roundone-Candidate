-- LiveKit opens 15 minutes before bookings.starts_at.
-- A new join stays open until start + 15 minutes.
-- The scheduled end stays bookings.ends_at. Early or late joining does not move it.
-- now() is database time. The browser clock cannot bypass this.

CREATE OR REPLACE FUNCTION private.interview_call_access(p_booking_id uuid, p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_session public.interview_sessions%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_role text;
  v_user uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_booking_id IS NULL AND p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT * INTO v_session FROM public.interview_sessions AS sessions WHERE sessions.id = p_session_id;
  ELSE
    SELECT * INTO v_session FROM public.interview_sessions AS sessions WHERE sessions.booking_id = p_booking_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_booking_id IS NOT NULL AND v_session.booking_id IS DISTINCT FROM p_booking_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking FROM public.bookings AS bookings WHERE bookings.id = v_session.booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF private.owns_candidate_profile(v_booking.candidate_profile_id) THEN
    v_role := 'candidate';
  ELSIF private.owns_interviewer_profile(v_booking.interviewer_profile_id) THEN
    v_role := 'interviewer';
  ELSE
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'booking_id', v_booking.id,
    'role', v_role,
    'room_name', private.interview_room_name(v_session.id),
    'participant_identity', v_role || ':' || v_user::text,
    'status', v_booking.status,
    'lobby_opens_at', v_booking.starts_at - interval '15 minutes',
    'starts_at', v_booking.starts_at,
    'join_deadline', LEAST(v_booking.starts_at + interval '15 minutes', v_booking.ends_at),
    'ends_at', v_booking.ends_at,
    'duration_min', v_booking.duration_min,
    'session_started_at', v_session.started_at,
    'session_ended_at', v_session.ended_at,
    'has_joined', EXISTS (
      SELECT 1
      FROM public.session_events AS events
      WHERE events.session_id = v_session.id
        AND events.event_type = 'participant_joined'
        AND events.actor_profile_id = v_user
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.interview_call_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.interview_call_access(uuid, uuid) TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.interview_call_context(
  p_booking_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_access jsonb;
  v_now timestamptz := now();
BEGIN
  v_access := private.interview_call_access(p_booking_id, p_session_id);

  IF v_access->>'status' NOT IN ('confirmed', 'in_progress') THEN
    RAISE EXCEPTION 'booking_not_confirmed' USING ERRCODE = '42501';
  END IF;

  IF v_access->>'session_ended_at' IS NOT NULL
     OR v_now >= (v_access->>'ends_at')::timestamptz THEN
    RAISE EXCEPTION 'session_expired' USING ERRCODE = '42501';
  END IF;

  IF v_now < (v_access->>'lobby_opens_at')::timestamptz THEN
    RAISE EXCEPTION 'interview_not_started' USING ERRCODE = '42501';
  END IF;

  IF v_access->>'status' = 'confirmed'
     AND COALESCE((v_access->>'has_joined')::boolean, false) = false
     AND v_now > (v_access->>'join_deadline')::timestamptz THEN
    RAISE EXCEPTION 'join_window_closed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_access->>'session_id',
    'booking_id', v_access->>'booking_id',
    'role', v_access->>'role',
    'room_name', v_access->>'room_name',
    'participant_identity', v_access->>'participant_identity',
    'starts_at', v_access->>'starts_at',
    'join_deadline', v_access->>'join_deadline',
    'ends_at', v_access->>'ends_at'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.interview_call_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.interview_call_context(uuid, uuid) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.get_interview_timing(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_access jsonb;
  v_now timestamptz := now();
  v_phase text;
  v_candidate_last text;
  v_admission text;
  v_no_show text;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  v_access := private.interview_call_access(NULL, p_session_id);

  v_phase := CASE
    WHEN v_access->>'status' NOT IN ('confirmed', 'in_progress') THEN 'closed'
    WHEN v_access->>'session_ended_at' IS NOT NULL OR v_now >= (v_access->>'ends_at')::timestamptz THEN 'ended'
    WHEN v_now < (v_access->>'lobby_opens_at')::timestamptz THEN 'scheduled'
    WHEN v_now < (v_access->>'starts_at')::timestamptz THEN 'lobby'
    ELSE 'live'
  END;

  SELECT events.event_type INTO v_candidate_last
  FROM public.session_events AS events
  WHERE events.session_id = p_session_id
    AND events.event_type IN ('participant_joined', 'participant_left')
    AND events.payload->>'role' = 'candidate'
  ORDER BY events.created_at DESC
  LIMIT 1;

  SELECT admissions.status INTO v_admission
  FROM public.interview_admissions AS admissions
  WHERE admissions.session_id = p_session_id;

  SELECT events.payload->>'absent_role' INTO v_no_show
  FROM public.session_events AS events
  WHERE events.session_id = p_session_id
    AND events.event_type IN ('candidate_no_show', 'interviewer_no_show')
  ORDER BY events.created_at DESC
  LIMIT 1;

  RETURN (v_access - 'room_name' - 'participant_identity') || jsonb_build_object(
    'server_now', v_now,
    'phase', v_phase,
    'can_join', v_phase IN ('lobby', 'live')
      AND (v_now <= (v_access->>'join_deadline')::timestamptz OR (v_access->>'has_joined')::boolean),
    'candidate_joined', v_candidate_last IS NOT NULL,
    'candidate_presence', CASE v_candidate_last
      WHEN 'participant_joined' THEN 'in_call'
      WHEN 'participant_left' THEN 'left'
      ELSE NULL
    END,
    'candidate_in_lobby', EXISTS (
      SELECT 1 FROM public.session_events AS events
      WHERE events.session_id = p_session_id
        AND events.event_type = 'lobby_entered'
        AND events.payload->>'role' = 'candidate'
    ),
    'interviewer_joined', EXISTS (
      SELECT 1 FROM public.session_events AS events
      WHERE events.session_id = p_session_id
        AND events.event_type = 'participant_joined'
        AND events.payload->>'role' = 'interviewer'
    ),
    'admission', v_admission,
    'no_show_role', v_no_show
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_interview_timing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_interview_timing(uuid) TO authenticated, postgres, service_role;
