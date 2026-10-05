-- Skill matching stays independent of interviewer services.
-- Candidate preferred end date, canonical skill uniqueness, and account deletion.

COMMENT ON FUNCTION public.match_interviewers_by_skills(text[]) IS
  'Skill-only match. Requires an active interviewer profile and at least one interviewer skill. Does not require a service, listing, or availability. Score is distinct canonical skill overlap. Zero overlap is excluded.';

ALTER TABLE public.candidate_preferences
  ADD COLUMN IF NOT EXISTS preferred_end_date date;

ALTER TABLE public.candidate_preferences
  DROP CONSTRAINT IF EXISTS candidate_preferences_date_range_chk;

ALTER TABLE public.candidate_preferences
  ADD CONSTRAINT candidate_preferences_date_range_chk
  CHECK (
    preferred_end_date IS NULL
    OR preferred_date IS NULL
    OR preferred_end_date >= preferred_date
  );

COMMENT ON COLUMN public.candidate_preferences.preferred_date IS
  'Preferred start date (date only). Empty means any day.';

COMMENT ON COLUMN public.candidate_preferences.preferred_end_date IS
  'Preferred end date (date only), inclusive. Empty with a start date means that single day.';

CREATE OR REPLACE FUNCTION private.reject_duplicate_candidate_skill()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS candidate_skills_reject_canonical_duplicate ON public.candidate_skills;

CREATE TRIGGER candidate_skills_reject_canonical_duplicate
  BEFORE INSERT OR UPDATE OF skill, candidate_profile_id
  ON public.candidate_skills
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_duplicate_candidate_skill();

REVOKE ALL ON FUNCTION private.reject_duplicate_candidate_skill() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_booking_preferred_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
DECLARE
  v_start date;
  v_end date;
  v_day date;
BEGIN
  IF NEW.candidate_profile_id IS NULL OR NEW.starts_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT preferred_date, preferred_end_date
  INTO v_start, v_end
  FROM public.candidate_preferences
  WHERE candidate_profile_id = NEW.candidate_profile_id;

  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_end IS NULL OR v_end < v_start THEN
    v_end := v_start;
  END IF;

  v_day := (NEW.starts_at AT TIME ZONE NEW.display_timezone)::date;

  IF v_day < v_start OR v_day > v_end THEN
    RAISE EXCEPTION 'outside_preferred_dates' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_preferred_dates ON public.bookings;

CREATE TRIGGER bookings_preferred_dates
  BEFORE INSERT OR UPDATE OF starts_at, display_timezone, candidate_profile_id
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_booking_preferred_dates();

REVOKE ALL ON FUNCTION private.enforce_booking_preferred_dates() FROM PUBLIC, anon, authenticated;

-- Shared marketplace rows stay. Personal identity is detached or removed.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND (
        (
          c.confrelid = 'public.candidate_profiles'::regclass
          AND a.attname = 'candidate_profile_id'
          AND c.conrelid IN (
            'public.bookings'::regclass,
            'public.payments'::regclass,
            'public.interviewer_feedback'::regclass,
            'public.candidate_reviews'::regclass
          )
        )
        OR (
          c.confrelid = 'public.profiles'::regclass
          AND a.attname IN ('actor_profile_id', 'decided_by', 'moderation_admin_id', 'reviewer_admin_id')
          AND c.conrelid IN (
            'public.booking_events'::regclass,
            'public.session_events'::regclass,
            'public.interview_admissions'::regclass,
            'public.candidate_reviews'::regclass,
            'public.interviewer_verifications'::regclass
          )
        )
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.tbl, rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.bookings
  ALTER COLUMN candidate_profile_id DROP NOT NULL;

ALTER TABLE public.payments
  ALTER COLUMN candidate_profile_id DROP NOT NULL;

ALTER TABLE public.interviewer_feedback
  ALTER COLUMN candidate_profile_id DROP NOT NULL;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_candidate_profile_id_fkey
  FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles (id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_candidate_profile_id_fkey
  FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles (id) ON DELETE SET NULL;

ALTER TABLE public.interviewer_feedback
  ADD CONSTRAINT interviewer_feedback_candidate_profile_id_fkey
  FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles (id) ON DELETE SET NULL;

ALTER TABLE public.candidate_reviews
  ADD CONSTRAINT candidate_reviews_candidate_profile_id_fkey
  FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.candidate_reviews
  ADD CONSTRAINT candidate_reviews_moderation_admin_id_fkey
  FOREIGN KEY (moderation_admin_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.booking_events
  ADD CONSTRAINT booking_events_actor_profile_id_fkey
  FOREIGN KEY (actor_profile_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_actor_profile_id_fkey
  FOREIGN KEY (actor_profile_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.interview_admissions
  ADD CONSTRAINT interview_admissions_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.interviewer_verifications
  ADD CONSTRAINT interviewer_verifications_reviewer_admin_id_fkey
  FOREIGN KEY (reviewer_admin_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_candidate() THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.interviewer_profiles
    WHERE profile_id = v_user
  ) THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  SELECT id
  INTO v_candidate
  FROM public.candidate_profiles
  WHERE profile_id = v_user;

  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE candidate_profile_id = v_candidate
      AND status = 'in_progress'::public.booking_status
  ) THEN
    RAISE EXCEPTION 'interview_in_progress' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled'::public.booking_status,
    hold_expires_at = NULL
  WHERE candidate_profile_id = v_candidate
    AND status IN (
      'pending_payment'::public.booking_status,
      'requested'::public.booking_status,
      'confirmed'::public.booking_status
    )
    AND starts_at > now();

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

  DELETE FROM auth.users
  WHERE id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION private.delete_own_candidate_account() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_candidate_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  PERFORM private.delete_own_candidate_account();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_candidate_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_candidate_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_candidate_account() IS
  'Deletes the signed-in candidate auth user and personal profile data. Cancels future bookings and detaches shared transaction rows. Cannot delete another user.';
