-- =============================================================================
-- RoundOne admin seed — DO NOT RUN as part of the automatic migration.
-- Public signup never creates an admin.
--
-- Steps:
-- 1. Create the admin Auth user in the Supabase Dashboard (Authentication).
-- 2. Copy the user UUID.
-- 3. Replace the placeholder below and run this file once as a privileged role.
-- 4. Sign the user out and back in so JWT app_metadata.role = admin is fresh.
-- =============================================================================

-- begin;

-- \set admin_id '00000000-0000-0000-0000-000000000000'

-- DELETE FROM public.candidate_preferences
-- WHERE candidate_profile_id IN (
--   SELECT id FROM public.candidate_profiles WHERE profile_id = :'admin_id'::uuid
-- );
-- DELETE FROM public.candidate_profiles WHERE profile_id = :'admin_id'::uuid;
-- DELETE FROM public.interviewer_profiles WHERE profile_id = :'admin_id'::uuid;

-- UPDATE public.profiles
-- SET
--   role = 'admin',
--   is_active = true
-- WHERE id = :'admin_id'::uuid;

-- UPDATE auth.users
-- SET raw_app_meta_data =
--   COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
-- WHERE id = :'admin_id'::uuid;

-- -- Optional: revoke other sessions so the new claim is required on next login.
-- -- DELETE FROM auth.sessions WHERE user_id = :'admin_id'::uuid;

-- commit;

DO $$
BEGIN
  RAISE NOTICE 'Admin seed is a manual script. See comments in supabase/seeds/admin_seed.sql — nothing was applied.';
END $$;
