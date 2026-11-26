-- Helper used by delete-interviewer-account: free email + OAuth without banning.
-- Banning left Google identities attached and caused "User is banned" on re-login.

CREATE OR REPLACE FUNCTION private.scrub_auth_user_after_persona_delete(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;

  DELETE FROM auth.identities WHERE user_id = p_user_id;

  UPDATE auth.users
  SET
    email = 'deleted+' || replace(p_user_id::text, '-', '') || '@deleted.invalid',
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    phone = NULL,
    banned_until = NULL,
    encrypted_password = NULL,
    raw_user_meta_data = '{}'::jsonb,
    raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
  WHERE id = p_user_id;

  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION private.scrub_auth_user_after_persona_delete(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.scrub_auth_user_after_persona_delete(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.scrub_auth_user_after_persona_delete(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
  SELECT private.scrub_auth_user_after_persona_delete(p_user_id);
$$;

REVOKE ALL ON FUNCTION public.scrub_auth_user_after_persona_delete(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scrub_auth_user_after_persona_delete(uuid) TO service_role;
