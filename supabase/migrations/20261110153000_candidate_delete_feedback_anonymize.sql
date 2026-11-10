-- Candidate self-delete must anonymize historical interviewer_feedback links.
-- FK ON DELETE SET NULL on interviewer_feedback was blocked by protect_feedback_immutable.

CREATE OR REPLACE FUNCTION private.protect_feedback_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.candidate_profile_id IS NOT NULL
       AND NEW.candidate_profile_id IS NULL
       AND NEW.booking_id IS NOT DISTINCT FROM OLD.booking_id
       AND NEW.interviewer_profile_id IS NOT DISTINCT FROM OLD.interviewer_profile_id
       AND NEW.technical_skills IS NOT DISTINCT FROM OLD.technical_skills
       AND NEW.problem_solving IS NOT DISTINCT FROM OLD.problem_solving
       AND NEW.communication IS NOT DISTINCT FROM OLD.communication
       AND NEW.system_design IS NOT DISTINCT FROM OLD.system_design
       AND NEW.coding IS NOT DISTINCT FROM OLD.coding
       AND NEW.behavioral IS NOT DISTINCT FROM OLD.behavioral
       AND NEW.overall IS NOT DISTINCT FROM OLD.overall
       AND NEW.strengths IS NOT DISTINCT FROM OLD.strengths
       AND NEW.improvements IS NOT DISTINCT FROM OLD.improvements
       AND NEW.summary IS NOT DISTINCT FROM OLD.summary
       AND NEW.readiness IS NOT DISTINCT FROM OLD.readiness
       AND NEW.internal_notes IS NOT DISTINCT FROM OLD.internal_notes
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Interviewer feedback cannot be updated after submit'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

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

  UPDATE public.interviewer_feedback
  SET candidate_profile_id = NULL
  WHERE candidate_profile_id = v_candidate;

  UPDATE public.payments
  SET candidate_profile_id = NULL
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
  'Deletes the signed-in candidate persona. Cancels open bookings, anonymizes shared feedback/payment rows, then removes the candidate profile or auth user.';
