-- One email can use both websites: keep candidate and interviewer personas on the same auth user.
-- Also fix skill inserts: the duplicate-skill trigger must run as definer so private.canonical_skill_key is allowed.

CREATE OR REPLACE FUNCTION private.enforce_single_persona()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = NEW.profile_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role = 'admin'::public.user_role THEN
    RAISE EXCEPTION 'admin accounts cannot hold candidate or interviewer personas'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.reject_duplicate_candidate_skill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF private.canonical_skill_key(NEW.skill) IS NULL THEN
    RAISE EXCEPTION 'invalid_skill' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.candidate_skills existing
    WHERE existing.candidate_profile_id = NEW.candidate_profile_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND private.canonical_skill_key(existing.skill) = private.canonical_skill_key(NEW.skill)
  ) THEN
    RAISE EXCEPTION 'duplicate_skill' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.reject_duplicate_candidate_skill() FROM PUBLIC, anon, authenticated;

-- Additive: create interviewer persona without removing candidate data.
CREATE OR REPLACE FUNCTION public.claim_interviewer_persona()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  v_role public.user_role;
  v_timezone text;
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

  IF EXISTS (
    SELECT 1 FROM public.interviewer_profiles WHERE profile_id = uid
  ) THEN
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

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_interviewer_persona() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_interviewer_persona() TO authenticated;

COMMENT ON FUNCTION public.claim_interviewer_persona() IS
  'Ensures the signed-in user has an interviewer persona. Keeps any existing candidate persona so one email can use both apps.';

-- Additive: create candidate persona without removing interviewer data.
CREATE OR REPLACE FUNCTION public.claim_candidate_persona()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  v_role public.user_role;
  v_candidate_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = uid;

  IF NOT FOUND OR v_role = 'admin'::public.user_role THEN
    RETURN false;
  END IF;

  SELECT cp.id INTO v_candidate_id
  FROM public.candidate_profiles cp
  WHERE cp.profile_id = uid;

  IF v_candidate_id IS NOT NULL THEN
    RETURN true;
  END IF;

  INSERT INTO public.candidate_profiles (profile_id)
  VALUES (uid)
  RETURNING id INTO v_candidate_id;

  INSERT INTO public.candidate_preferences (candidate_profile_id)
  VALUES (v_candidate_id)
  ON CONFLICT (candidate_profile_id) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_candidate_persona() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_candidate_persona() TO authenticated;

COMMENT ON FUNCTION public.claim_candidate_persona() IS
  'Ensures the signed-in user has a candidate persona. Keeps any existing interviewer persona so one email can use both apps.';

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
    -- Leave profiles.role alone; only admins may change it.
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
  'Deletes the signed-in candidate persona. Cancels open interviews. If the same email also has an interviewer persona, that interviewer account is kept.';
