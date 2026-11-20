-- Candidate app re-signin after account delete (or a shared-profile tombstone) must
-- restore a usable display name and reactivate the profile so welcome/dashboard
-- never show "Welcome back, Deleted".

CREATE OR REPLACE FUNCTION public.claim_candidate_persona()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, auth
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_role public.user_role;
  v_candidate_id uuid;
  v_meta_name text;
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

  v_meta_name := NULLIF(btrim(COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', '')), '');

  -- Always reclaim tombstones left by interviewer (or prior) account deletion.
  UPDATE public.profiles
  SET is_active = true,
      full_name = CASE
        WHEN full_name IN ('Deleted interviewer', 'Deleted', 'Deleted candidate') THEN COALESCE(
          v_meta_name,
          NULLIF(split_part(COALESCE(auth.jwt() ->> 'email', ''), '@', 1), ''),
          'Candidate'
        )
        ELSE full_name
      END
  WHERE id = uid
    AND (
      is_active = false
      OR full_name IN ('Deleted interviewer', 'Deleted', 'Deleted candidate')
    );

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
$function$;

REVOKE ALL ON FUNCTION public.claim_candidate_persona() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_candidate_persona() TO authenticated, service_role;

COMMENT ON FUNCTION public.claim_candidate_persona() IS
  'Ensures the signed-in user has a candidate persona. Restores soft-delete tombstone names so welcome and dashboard show a real name.';
