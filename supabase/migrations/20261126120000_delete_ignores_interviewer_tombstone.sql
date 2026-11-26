-- Soft-deleted interviewer personas left a tombstone row. Candidate self-delete
-- treated that as "still has interviewer" and kept auth.users, so Create account
-- said "already exists" and Google-only users could not sign in with a password.
-- Live interviewers still keep auth (dual persona). Tombstones do not.

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
  v_has_live_interviewer boolean := false;
  v_ip uuid;
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

  -- Only a live interviewer persona should keep auth. Soft-delete tombstones
  -- (Deleted/Pending placeholders) must not block auth removal.
  SELECT EXISTS (
    SELECT 1
    FROM public.interviewer_profiles ip
    WHERE ip.profile_id = v_user
      AND NOT (
        (ip."current_role" IN ('Deleted', 'Pending') AND ip.company IN ('Deleted', 'Pending'))
      )
  ) INTO v_has_live_interviewer;

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

  DELETE FROM public.candidate_profiles
  WHERE id = v_candidate;

  IF v_has_live_interviewer THEN
    RETURN;
  END IF;

  -- No live interviewer left: remove soft-deleted interviewer tombstone when safe,
  -- then remove the auth user so the email can register again.
  SELECT id INTO v_ip
  FROM public.interviewer_profiles
  WHERE profile_id = v_user
  FOR UPDATE;

  IF v_ip IS NOT NULL THEN
    DELETE FROM public.interviewer_feedback WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_skills WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_roles WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_availability WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_custom_slots WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_blocked_times WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_verifications WHERE interviewer_profile_id = v_ip;

    DELETE FROM public.interviewer_services s
    WHERE s.interviewer_profile_id = v_ip
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.service_id = s.id);
    UPDATE public.interviewer_services
    SET is_active = false, description = NULL
    WHERE interviewer_profile_id = v_ip;

    IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE interviewer_profile_id = v_ip)
       AND NOT EXISTS (SELECT 1 FROM public.candidate_reviews WHERE interviewer_profile_id = v_ip) THEN
      DELETE FROM public.interviewer_profiles WHERE id = v_ip;
    END IF;
  END IF;

  DELETE FROM public.notifications WHERE profile_id = v_user;
  DELETE FROM public.notification_preferences WHERE profile_id = v_user;

  DELETE FROM auth.users
  WHERE id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION private.delete_own_candidate_account() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.delete_my_candidate_account() IS
  'Deletes the signed-in candidate persona. Keeps auth only when a live interviewer persona remains; soft-deleted interviewer tombstones no longer block auth removal.';
