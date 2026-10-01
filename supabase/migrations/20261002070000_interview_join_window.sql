-- Refuse LiveKit access until the existing 15-minute join window.
-- bookings.starts_at is timestamptz. now() is database time, not the client clock.
-- This matches src JOIN_WINDOW_BEFORE_MS (15 minutes).

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

  IF v_booking.status NOT IN (
    'confirmed'::public.booking_status,
    'in_progress'::public.booking_status
  ) THEN
    RAISE EXCEPTION 'booking_not_confirmed' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status = 'confirmed'::public.booking_status
     AND now() < v_booking.starts_at - interval '15 minutes' THEN
    RAISE EXCEPTION 'interview_not_started' USING ERRCODE = '42501';
  END IF;

  IF v_session.ended_at IS NOT NULL OR now() > v_booking.ends_at + interval '30 minutes' THEN
    RAISE EXCEPTION 'session_expired' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'booking_id', v_booking.id,
    'role', v_role,
    'room_name', private.interview_room_name(v_session.id),
    'participant_identity', v_role || ':' || v_user::text
  );
END;
$$;
