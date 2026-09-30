-- Avoid output-column names clashing with interview_sessions.booking_id.

DROP FUNCTION IF EXISTS public.prepare_interview_call(uuid, uuid);
DROP FUNCTION IF EXISTS public.begin_interview_call(uuid);
DROP FUNCTION IF EXISTS public.record_interview_call_event(uuid, text);
DROP FUNCTION IF EXISTS private.interview_call_context(uuid, uuid);

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

REVOKE ALL ON FUNCTION private.interview_call_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.interview_call_context(uuid, uuid) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.prepare_interview_call(
  p_booking_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  RETURN private.interview_call_context(p_booking_id, p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_interview_call(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_access jsonb;
  v_session_id uuid;
  v_booking_id uuid;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_access := private.interview_call_context(NULL, p_session_id);
  v_session_id := (v_access->>'session_id')::uuid;
  v_booking_id := (v_access->>'booking_id')::uuid;

  SELECT * INTO v_booking FROM public.bookings AS bookings WHERE bookings.id = v_booking_id FOR UPDATE;
  IF v_booking.status = 'confirmed'::public.booking_status THEN
    UPDATE public.bookings AS bookings
    SET status = 'in_progress'::public.booking_status
    WHERE bookings.id = v_booking.id
      AND bookings.status = 'confirmed'::public.booking_status;
  END IF;

  UPDATE public.interview_sessions AS sessions
  SET
    provider = 'livekit',
    started_at = COALESCE(sessions.started_at, now())
  WHERE sessions.id = v_session_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.session_events AS events
    WHERE events.session_id = v_session_id
      AND events.event_type = 'call_opened'
  ) THEN
    INSERT INTO public.session_events (session_id, event_type, actor_profile_id, payload)
    VALUES (
      v_session_id,
      'call_opened',
      auth.uid(),
      jsonb_build_object('role', v_access->>'role')
    );
  END IF;

  INSERT INTO public.session_events (session_id, event_type, actor_profile_id, payload)
  VALUES (
    v_session_id,
    'participant_joined',
    auth.uid(),
    jsonb_build_object('role', v_access->>'role')
  );

  RETURN v_access;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_interview_call_event(
  p_session_id uuid,
  p_event text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_access jsonb;
  v_event text;
BEGIN
  v_event := lower(btrim(COALESCE(p_event, '')));
  IF v_event NOT IN ('participant_joined', 'participant_left', 'call_ended') THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_access := private.interview_call_context(NULL, p_session_id);

  INSERT INTO public.session_events (session_id, event_type, actor_profile_id, payload)
  VALUES (
    (v_access->>'session_id')::uuid,
    v_event,
    auth.uid(),
    jsonb_build_object('role', v_access->>'role')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_interview_call(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.begin_interview_call(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_interview_call_event(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.prepare_interview_call(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_interview_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_interview_call_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_interview_call(uuid, uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.begin_interview_call(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.record_interview_call_event(uuid, text) TO postgres, service_role;
