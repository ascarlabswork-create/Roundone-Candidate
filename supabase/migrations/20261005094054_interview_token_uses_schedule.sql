-- Token checks use the same schedule as private.interview_call_access.
-- Join deadline is the earlier of start + 15 minutes and bookings.ends_at.
-- A participant who already joined may reconnect until that scheduled end.

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

  IF v_now < (v_access->>'starts_at')::timestamptz THEN
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
    'participant_identity', v_access->>'participant_identity'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.interview_call_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.interview_call_context(uuid, uuid) TO postgres, service_role;
