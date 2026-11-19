-- After account delete, soft-kept interviewer rows use Deleted/Pending placeholders
-- and may leave profiles.is_active = false. Reclaim only those tombstones on claim
-- so the next sign-in lands on welcome again (do not wipe mid-onboarding Pending rows).

CREATE OR REPLACE FUNCTION public.claim_interviewer_persona()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, auth
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_role public.user_role;
  v_timezone text;
  v_ip uuid;
  v_reclaim boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.role, p.timezone
  INTO v_role, v_timezone
  FROM public.profiles p
  WHERE p.id = uid;

  IF NOT FOUND OR v_role = 'admin'::public.user_role THEN
    RETURN false;
  END IF;

  SELECT ip.id INTO v_ip
  FROM public.interviewer_profiles ip
  WHERE ip.profile_id = uid
  FOR UPDATE;

  IF v_ip IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.interviewer_profiles ip
      JOIN public.profiles p ON p.id = ip.profile_id
      WHERE ip.id = v_ip
        AND (
          (ip."current_role" = 'Deleted' AND ip.company = 'Deleted')
          OR (
            p.is_active = false
            AND ip."current_role" IN ('Deleted', 'Pending')
            AND ip.company IN ('Deleted', 'Pending')
          )
        )
    )
    INTO v_reclaim;

    IF v_reclaim THEN
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
          available_until = NULL
      WHERE id = v_ip;

      DELETE FROM public.interviewer_skills WHERE interviewer_profile_id = v_ip;
      DELETE FROM public.interviewer_roles WHERE interviewer_profile_id = v_ip;

      UPDATE public.profiles
      SET is_active = true,
          full_name = CASE
            WHEN full_name IN ('Deleted interviewer', 'Deleted') THEN COALESCE(
              NULLIF(btrim(COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', '')), ''),
              'Interviewer'
            )
            ELSE full_name
          END
      WHERE id = uid
        AND is_active = false;
    END IF;

    RETURN true;
  END IF;

  INSERT INTO public.interviewer_profiles (
    profile_id,
    "current_role",
    company,
    timezone,
    list_price_paise,
    is_listed
  )
  VALUES (
    uid,
    'Pending',
    'Pending',
    COALESCE(NULLIF(btrim(v_timezone), ''), 'Asia/Kolkata'),
    0,
    false
  );

  UPDATE public.profiles
  SET is_active = true
  WHERE id = uid
    AND is_active = false;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_interviewer_persona() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_interviewer_persona() TO authenticated, service_role;

COMMENT ON FUNCTION public.claim_interviewer_persona() IS
  'Ensures the signed-in user has an interviewer persona. Soft-deleted tombstones are reset to Pending so welcome runs again.';

-- Soft-delete tombstone: keep the row for booking history, use Pending placeholders
-- so the next sign-in is treated as a fresh welcome profile (skills already cleared).
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

  v_dual_candidate := v_role = 'candidate'::public.user_role;

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
          available_until = NULL
      WHERE id = v_ip;
    END IF;
  ELSE
    v_profile_deleted := true;
  END IF;

  UPDATE public.booking_events SET actor_profile_id = NULL WHERE actor_profile_id = p_profile_id;
  UPDATE public.session_events SET actor_profile_id = NULL WHERE actor_profile_id = p_profile_id;
  UPDATE public.interview_admissions SET decided_by = NULL WHERE decided_by = p_profile_id;

  IF NOT v_dual_candidate THEN
    DELETE FROM public.notifications WHERE profile_id = p_profile_id;
    DELETE FROM public.notification_preferences WHERE profile_id = p_profile_id;

    UPDATE public.profiles
    SET full_name = 'Deleted interviewer',
        avatar_url = NULL,
        is_active = false
    WHERE id = p_profile_id;
  END IF;

  v_hard := (NOT v_dual_candidate)
    AND v_profile_deleted
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE admin_profile_id = p_profile_id)
    AND NOT EXISTS (SELECT 1 FROM public.interviewer_verifications WHERE reviewer_admin_id = p_profile_id)
    AND NOT EXISTS (SELECT 1 FROM public.candidate_reviews WHERE moderation_admin_id = p_profile_id);

  v_delete_auth := v_hard;

  RETURN jsonb_build_object(
    'hard_delete', v_hard,
    'delete_auth_user', v_delete_auth,
    'cancelled_bookings', v_cancelled
  );
END;
$function$;
