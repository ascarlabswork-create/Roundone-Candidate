-- Candidate self-delete must not update profiles.role; that column is admin-only.
-- When an interviewer persona also exists, remove only the candidate persona.

CREATE OR REPLACE FUNCTION private.delete_own_candidate_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
#variable_conflict use_column
DECLARE
  v_user uuid := auth.uid();
  v_candidate uuid;
  v_has_interviewer boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_candidate() THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  SELECT id
  INTO v_candidate
  FROM public.candidate_profiles
  WHERE profile_id = v_user;

  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.interviewer_profiles WHERE profile_id = v_user
  ) INTO v_has_interviewer;

  UPDATE public.bookings
  SET
    status = 'cancelled'::public.booking_status,
    hold_expires_at = NULL
  WHERE candidate_profile_id = v_candidate
    AND status IN (
      'pending_payment'::public.booking_status,
      'requested'::public.booking_status,
      'confirmed'::public.booking_status,
      'in_progress'::public.booking_status
    );

  DELETE FROM public.candidate_reviews
  WHERE candidate_profile_id = v_candidate;

  UPDATE public.booking_events
  SET actor_profile_id = NULL
  WHERE actor_profile_id = v_user;

  UPDATE public.session_events
  SET actor_profile_id = NULL
  WHERE actor_profile_id = v_user;

  UPDATE public.interview_admissions
  SET decided_by = NULL
  WHERE decided_by = v_user;

  IF v_has_interviewer THEN
    DELETE FROM public.candidate_profiles
    WHERE id = v_candidate;
  ELSE
    DELETE FROM auth.users
    WHERE id = v_user;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.delete_own_candidate_account() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.delete_my_candidate_account() IS
  'Deletes the signed-in candidate persona without changing profiles.role. Cancels open interviews. Keeps an interviewer persona on the same email when one exists.';
