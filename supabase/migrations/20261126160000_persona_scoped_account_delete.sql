-- Persona-scoped account delete:
-- - Interviewer delete removes only interviewer data; keeps candidate + auth if present.
-- - Candidate delete removes only candidate data; keeps interviewer + auth if present.
-- Auth email is freed only when no other persona remains on the same login.

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

  -- Any interviewer row (live or tombstone) means this login still belongs to Experts.
  SELECT EXISTS (
    SELECT 1
    FROM public.interviewer_profiles ip
    WHERE ip.profile_id = v_user
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

  DELETE FROM public.candidate_profiles
  WHERE id = v_candidate;

  IF v_has_interviewer THEN
    -- Keep shared auth + profile for the interviewer app.
    UPDATE public.profiles
    SET role = 'interviewer'::public.user_role
    WHERE id = v_user
      AND role = 'candidate'::public.user_role;
    RETURN;
  END IF;

  DELETE FROM public.notifications WHERE profile_id = v_user;
  DELETE FROM public.notification_preferences WHERE profile_id = v_user;

  UPDATE public.profiles
  SET full_name = 'Deleted account',
      avatar_url = NULL,
      is_active = false
  WHERE id = v_user;

  DELETE FROM auth.identities WHERE user_id = v_user;

  UPDATE auth.users
  SET
    email = 'deleted+' || replace(v_user::text, '-', '') || '@deleted.invalid',
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    phone = NULL,
    encrypted_password = NULL,
    raw_user_meta_data = '{}'::jsonb,
    raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
  WHERE id = v_user;

  BEGIN
    DELETE FROM auth.users WHERE id = v_user;
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION private.delete_own_candidate_account() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.delete_interviewer_account(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_role public.user_role;
  v_ip uuid;
  v_booking_id uuid;
  v_cancelled integer := 0;
  v_profile_deleted boolean := false;
  v_hard boolean;
  v_delete_auth boolean := false;
  v_dual_candidate boolean := false;
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role = 'admin'::public.user_role THEN
    RAISE EXCEPTION 'not_interviewer' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_ip FROM public.interviewer_profiles WHERE profile_id = p_profile_id FOR UPDATE;

  IF v_ip IS NULL AND v_role <> 'interviewer'::public.user_role THEN
    RAISE EXCEPTION 'not_interviewer' USING ERRCODE = '42501';
  END IF;

  -- Candidate persona on the same login must survive interviewer delete.
  v_dual_candidate := EXISTS (
    SELECT 1 FROM public.candidate_profiles WHERE profile_id = p_profile_id
  );

  IF v_ip IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE interviewer_profile_id = v_ip
        AND status = 'in_progress'::public.booking_status
        AND ends_at > now() - interval '2 hours'
    ) THEN
      RAISE EXCEPTION 'interview_in_progress' USING ERRCODE = 'P0001';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', p_profile_id::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', p_profile_id, 'role', 'authenticated')::text,
      true
    );
    FOR v_booking_id IN
      SELECT id FROM public.bookings
      WHERE interviewer_profile_id = v_ip
        AND status IN (
          'pending_payment'::public.booking_status,
          'requested'::public.booking_status,
          'confirmed'::public.booking_status
        )
      ORDER BY starts_at
    LOOP
      PERFORM public.cancel_booking(v_booking_id, 'interviewer_account_deleted');
      v_cancelled := v_cancelled + 1;
    END LOOP;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);

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
      v_profile_deleted := true;
    ELSE
      UPDATE public.interviewer_profiles
      SET headline = NULL,
          bio = NULL,
          "current_role" = 'Pending',
          company = 'Pending',
          experience_years = 0,
          languages = '{}',
          is_listed = false,
          is_online = false,
          whatsapp_phone = NULL,
          available_from = NULL,
          available_until = NULL,
          welcome_completed_at = NULL
      WHERE id = v_ip;
    END IF;
  ELSE
    v_profile_deleted := true;
  END IF;

  -- Only clear interviewer-side actor refs when this login is not still a candidate.
  IF NOT v_dual_candidate THEN
    UPDATE public.booking_events SET actor_profile_id = NULL WHERE actor_profile_id = p_profile_id;
    UPDATE public.session_events SET actor_profile_id = NULL WHERE actor_profile_id = p_profile_id;
    UPDATE public.interview_admissions SET decided_by = NULL WHERE decided_by = p_profile_id;

    DELETE FROM public.notifications WHERE profile_id = p_profile_id;
    DELETE FROM public.notification_preferences WHERE profile_id = p_profile_id;

    UPDATE public.profiles
    SET full_name = 'Deleted interviewer',
        avatar_url = NULL,
        is_active = false
    WHERE id = p_profile_id;
  ELSE
    UPDATE public.profiles
    SET role = 'candidate'::public.user_role
    WHERE id = p_profile_id
      AND role = 'interviewer'::public.user_role;
  END IF;

  v_hard := (NOT v_dual_candidate)
    AND v_profile_deleted
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE admin_profile_id = p_profile_id)
    AND NOT EXISTS (SELECT 1 FROM public.interviewer_verifications WHERE reviewer_admin_id = p_profile_id)
    AND NOT EXISTS (SELECT 1 FROM public.candidate_reviews WHERE moderation_admin_id = p_profile_id);

  -- Keep Authentication whenever a candidate persona remains on this login.
  v_delete_auth := NOT v_dual_candidate;

  RETURN jsonb_build_object(
    'hard_delete', v_hard,
    'delete_auth_user', v_delete_auth,
    'cancelled_bookings', v_cancelled,
    'kept_other_persona', v_dual_candidate
  );
END;
$function$;
