-- =============================================================================
-- RoundOne initial schema
-- Project: Roundone (fhcrxjrqtojixgqemofp)
-- Status: GENERATED ONLY — do not apply until explicitly approved.
-- Shared PostgreSQL for Candidate + Interviewer apps.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions and private schema
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('candidate', 'interviewer', 'admin');
CREATE TYPE public.booking_status AS ENUM (
  'pending_payment',
  'requested',
  'confirmed',
  'rejected',
  'cancelled',
  'expired',
  'rescheduled',
  'in_progress',
  'completed',
  'no_show'
);
CREATE TYPE public.verification_kind AS ENUM ('identity', 'employment', 'linkedin');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.readiness_level AS ENUM ('ready', 'almost_ready', 'needs_more_practice');
CREATE TYPE public.recommend_level AS ENUM ('yes', 'maybe', 'no');
CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_status AS ENUM ('created', 'pending', 'captured', 'failed', 'cancelled');

-- -----------------------------------------------------------------------------
-- 3. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.candidate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  headline text,
  bio text,
  target_role text,
  candidate_level text,
  target_company text,
  languages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.candidate_preferences (
  candidate_profile_id uuid PRIMARY KEY REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  interview_type text,
  skills text[] NOT NULL DEFAULT '{}',
  preferred_date date,
  preferred_time_window text,
  budget_max_paise integer,
  language text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_preferences_window_chk CHECK (
    preferred_time_window IS NULL
    OR preferred_time_window IN ('morning', 'afternoon', 'evening')
  ),
  CONSTRAINT candidate_preferences_budget_chk CHECK (
    budget_max_paise IS NULL OR budget_max_paise >= 0
  )
);

CREATE TABLE public.candidate_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  skill text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, skill)
);

CREATE TABLE public.interviewer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  headline text,
  bio text,
  "current_role" text NOT NULL,
  company text NOT NULL,
  experience_years integer NOT NULL DEFAULT 0,
  timezone text NOT NULL,
  booking_buffer_min integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  list_price_paise integer NOT NULL,
  is_listed boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT false,
  languages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interviewer_experience_years_chk CHECK (experience_years >= 0),
  CONSTRAINT interviewer_buffer_chk CHECK (booking_buffer_min >= 0),
  CONSTRAINT interviewer_list_price_chk CHECK (list_price_paise >= 0)
);

CREATE TABLE public.interviewer_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id) ON DELETE CASCADE,
  skill text NOT NULL,
  UNIQUE (interviewer_profile_id, skill)
);

CREATE TABLE public.interviewer_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id) ON DELETE CASCADE,
  target_role text NOT NULL,
  candidate_level text
);

CREATE UNIQUE INDEX interviewer_roles_unique_idx
  ON public.interviewer_roles (
    interviewer_profile_id,
    target_role,
    COALESCE(candidate_level, '')
  );

CREATE TABLE public.interviewer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  interview_type text NOT NULL,
  duration_min integer NOT NULL,
  price_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interviewer_services_duration_chk CHECK (duration_min > 0),
  CONSTRAINT interviewer_services_price_chk CHECK (price_paise >= 0)
);

CREATE TABLE public.interviewer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  UNIQUE (interviewer_profile_id, weekday, start_time, end_time),
  CONSTRAINT interviewer_availability_weekday_chk CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT interviewer_availability_window_chk CHECK (start_time < end_time)
);

CREATE TABLE public.interviewer_custom_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id) ON DELETE CASCADE,
  on_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CONSTRAINT interviewer_custom_slots_window_chk CHECK (start_time < end_time)
);

CREATE TABLE public.interviewer_blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id) ON DELETE CASCADE,
  on_date date NOT NULL,
  start_time time,
  end_time time,
  all_day boolean NOT NULL DEFAULT false,
  reason text,
  CONSTRAINT interviewer_blocked_window_chk CHECK (
    all_day
    OR (
      start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND start_time < end_time
    )
  )
);

CREATE TABLE public.interviewer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id) ON DELETE CASCADE,
  kind public.verification_kind NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  document_path text,
  reviewer_admin_id uuid REFERENCES public.profiles (id),
  reviewed_at timestamptz,
  notes text,
  UNIQUE (interviewer_profile_id, kind)
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id),
  service_id uuid NOT NULL REFERENCES public.interviewer_services (id),
  status public.booking_status NOT NULL DEFAULT 'pending_payment',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  display_timezone text NOT NULL,
  interviewer_timezone text NOT NULL,
  duration_min integer NOT NULL,
  session_fee_paise integer NOT NULL,
  platform_fee_paise integer NOT NULL,
  total_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  mode text NOT NULL DEFAULT 'video',
  hold_expires_at timestamptz,
  rejection_reason text,
  rescheduled_from_booking_id uuid REFERENCES public.bookings (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_interval_chk CHECK (starts_at < ends_at),
  CONSTRAINT bookings_duration_chk CHECK (duration_min > 0),
  CONSTRAINT bookings_total_chk CHECK (total_paise = session_fee_paise + platform_fee_paise),
  CONSTRAINT bookings_hold_chk CHECK (
    status <> 'pending_payment' OR hold_expires_at IS NOT NULL
  ),
  CONSTRAINT bookings_rescheduled_hold_chk CHECK (
    status <> 'rescheduled' OR hold_expires_at IS NULL
  )
);

-- Occupying statuses only. rescheduled/rejected/cancelled/expired/completed/no_show
-- do not block the interviewer calendar.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_interviewer_interval_excl
  EXCLUDE USING gist (
    interviewer_profile_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (
    status IN ('pending_payment', 'requested', 'confirmed', 'in_progress')
  );

-- A retired booking can have at most one successor.
CREATE UNIQUE INDEX bookings_one_successor_idx
  ON public.bookings (rescheduled_from_booking_id)
  WHERE rescheduled_from_booking_id IS NOT NULL;

CREATE TABLE public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  from_status public.booking_status,
  to_status public.booking_status NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles (id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stub',
  join_token_hash text,
  started_at timestamptz,
  ended_at timestamptz
);

CREATE TABLE public.session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles (id),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.interviewer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings (id),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id),
  technical_skills smallint NOT NULL,
  problem_solving smallint NOT NULL,
  communication smallint NOT NULL,
  system_design smallint,
  coding smallint,
  behavioral smallint,
  overall smallint NOT NULL,
  strengths text[] NOT NULL DEFAULT '{}',
  improvements text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  readiness public.readiness_level NOT NULL,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interviewer_feedback_scores_chk CHECK (
    technical_skills BETWEEN 1 AND 5
    AND problem_solving BETWEEN 1 AND 5
    AND communication BETWEEN 1 AND 5
    AND overall BETWEEN 1 AND 5
    AND (system_design IS NULL OR system_design BETWEEN 1 AND 5)
    AND (coding IS NULL OR coding BETWEEN 1 AND 5)
    AND (behavioral IS NULL OR behavioral BETWEEN 1 AND 5)
  )
);

CREATE TABLE public.candidate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings (id),
  interviewer_profile_id uuid NOT NULL REFERENCES public.interviewer_profiles (id),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id),
  overall_rating smallint NOT NULL,
  technical_expertise smallint NOT NULL,
  communication smallint NOT NULL,
  interview_realism smallint NOT NULL,
  feedback_quality smallint NOT NULL,
  professionalism smallint NOT NULL,
  recommend public.recommend_level NOT NULL,
  written_review text NOT NULL,
  show_name_publicly boolean NOT NULL DEFAULT false,
  display_name text NOT NULL,
  moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  moderation_admin_id uuid REFERENCES public.profiles (id),
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_reviews_scores_chk CHECK (
    overall_rating BETWEEN 1 AND 5
    AND technical_expertise BETWEEN 1 AND 5
    AND communication BETWEEN 1 AND 5
    AND interview_realism BETWEEN 1 AND 5
    AND feedback_quality BETWEEN 1 AND 5
    AND professionalism BETWEEN 1 AND 5
  )
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings (id),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id),
  amount_paise integer NOT NULL,
  platform_fee_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status public.payment_status NOT NULL DEFAULT 'created',
  provider text NOT NULL DEFAULT 'stub',
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_chk CHECK (amount_paise >= 0 AND platform_fee_paise >= 0)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  booking_updates boolean NOT NULL DEFAULT true,
  feedback_updates boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT false
);

CREATE INDEX bookings_interviewer_starts_idx ON public.bookings (interviewer_profile_id, starts_at);
CREATE INDEX bookings_candidate_starts_idx ON public.bookings (candidate_profile_id, starts_at);
CREATE INDEX bookings_pending_payment_idx
  ON public.bookings (hold_expires_at)
  WHERE status = 'pending_payment';
CREATE INDEX booking_events_booking_id_idx ON public.booking_events (booking_id, created_at);
CREATE INDEX candidate_reviews_approved_idx
  ON public.candidate_reviews (interviewer_profile_id)
  WHERE moderation_status = 'approved';
CREATE INDEX notifications_profile_created_idx ON public.notifications (profile_id, created_at DESC);
CREATE INDEX interviewer_availability_profile_idx ON public.interviewer_availability (interviewer_profile_id, weekday);
CREATE INDEX interviewer_custom_slots_profile_idx ON public.interviewer_custom_slots (interviewer_profile_id, on_date);
CREATE INDEX interviewer_blocked_times_profile_idx ON public.interviewer_blocked_times (interviewer_profile_id, on_date);
CREATE INDEX interviewer_services_profile_idx ON public.interviewer_services (interviewer_profile_id) WHERE is_active;
CREATE INDEX payments_candidate_idx ON public.payments (candidate_profile_id);

-- -----------------------------------------------------------------------------
-- 4. Helper functions (private)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.platform_fee_paise(p_session_fee_paise integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT GREATEST(4900, ROUND(p_session_fee_paise * 0.05)::integer);
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::public.user_role
  );
$$;

CREATE OR REPLACE FUNCTION private.is_candidate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_profiles cp
    WHERE cp.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.is_interviewer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.interviewer_profiles ip
    WHERE ip.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.owns_candidate_profile(p_candidate_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidate_profiles cp
    WHERE cp.id = p_candidate_profile_id
      AND cp.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.owns_interviewer_profile(p_interviewer_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.interviewer_profiles ip
    WHERE ip.id = p_interviewer_profile_id
      AND ip.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.current_candidate_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT cp.id
  FROM public.candidate_profiles cp
  WHERE cp.profile_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_interviewer_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT ip.id
  FROM public.interviewer_profiles ip
  WHERE ip.profile_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.can_read_booking(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT private.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.candidate_profiles cp ON cp.id = b.candidate_profile_id
    WHERE b.id = p_booking_id
      AND cp.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.interviewer_profiles ip ON ip.id = b.interviewer_profile_id
    WHERE b.id = p_booking_id
      AND ip.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.wall_tstz(p_date date, p_time time, p_tz text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT (p_date + p_time) AT TIME ZONE p_tz;
$$;

CREATE OR REPLACE FUNCTION private.review_display_name(p_full_name text, p_show_name boolean)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  parts text[];
  first_name text;
  last_initial text;
BEGIN
  IF NOT COALESCE(p_show_name, false) THEN
    RETURN 'Anonymous Candidate';
  END IF;

  parts := regexp_split_to_array(btrim(COALESCE(p_full_name, '')), '\s+');
  first_name := COALESCE(NULLIF(parts[1], ''), 'Candidate');
  IF array_length(parts, 1) >= 2 AND length(parts[array_length(parts, 1)]) > 0 THEN
    last_initial := upper(left(parts[array_length(parts, 1)], 1));
    RETURN first_name || ' ' || last_initial || '.';
  END IF;
  RETURN first_name;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify(
  p_profile_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notifications (profile_id, kind, title, body, payload)
  VALUES (p_profile_id, p_kind, p_title, p_body, COALESCE(p_payload, '{}'::jsonb));
END;
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_candidate() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_interviewer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_candidate_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_interviewer_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_booking(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Auth + persona triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.handle_new_user_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  requested text;
BEGIN
  requested := lower(COALESCE(
    NEW.raw_app_meta_data ->> 'role',
    NEW.raw_user_meta_data ->> 'role',
    'candidate'
  ));
  IF requested NOT IN ('candidate', 'interviewer') THEN
    requested := 'candidate';
  END IF;
  NEW.raw_app_meta_data :=
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', requested);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  requested public.user_role;
  v_name text;
  v_candidate_id uuid;
BEGIN
  requested := (NEW.raw_app_meta_data ->> 'role')::public.user_role;
  IF requested = 'admin'::public.user_role THEN
    requested := 'candidate'::public.user_role;
  END IF;

  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );

  INSERT INTO public.profiles (id, role, full_name, avatar_url, timezone)
  VALUES (
    NEW.id,
    requested,
    v_name,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'Asia/Kolkata')
  );

  INSERT INTO public.notification_preferences (profile_id)
  VALUES (NEW.id);

  IF requested = 'candidate'::public.user_role THEN
    INSERT INTO public.candidate_profiles (profile_id)
    VALUES (NEW.id)
    RETURNING id INTO v_candidate_id;

    INSERT INTO public.candidate_preferences (candidate_profile_id)
    VALUES (v_candidate_id);
  ELSIF requested = 'interviewer'::public.user_role THEN
    INSERT INTO public.interviewer_profiles (
      profile_id,
      "current_role",
      company,
      timezone,
      list_price_paise,
      is_listed
    )
    VALUES (
      NEW.id,
      'Pending',
      'Pending',
      COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'Asia/Kolkata'),
      0,
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_single_persona()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile_id uuid;
  v_role public.user_role;
BEGIN
  v_profile_id := NEW.profile_id;
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_profile_id;

  IF TG_TABLE_NAME = 'candidate_profiles' THEN
    IF v_role IS DISTINCT FROM 'candidate'::public.user_role THEN
      RAISE EXCEPTION 'candidate_profiles requires profiles.role = candidate'
        USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.interviewer_profiles ip WHERE ip.profile_id = v_profile_id
    ) THEN
      RAISE EXCEPTION 'MVP allows one persona per user'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'interviewer_profiles' THEN
    IF v_role IS DISTINCT FROM 'interviewer'::public.user_role THEN
      RAISE EXCEPTION 'interviewer_profiles requires profiles.role = interviewer'
        USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.candidate_profiles cp WHERE cp.profile_id = v_profile_id
    ) THEN
      RAISE EXCEPTION 'MVP allows one persona per user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.prevent_non_admin_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change profiles.role'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.reviewer_admin_id IS DISTINCT FROM NEW.reviewer_admin_id
    OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
  ) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change verification status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_review_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'pending'::public.moderation_status;
    NEW.moderation_admin_id := NULL;
    NEW.moderated_at := NULL;
    RETURN NEW;
  END IF;

  IF (
    OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
    OR OLD.moderation_admin_id IS DISTINCT FROM NEW.moderation_admin_id
    OR OLD.moderated_at IS DISTINCT FROM NEW.moderated_at
  ) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Only admins can moderate reviews'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    NEW.moderation_admin_id := auth.uid();
    NEW.moderated_at := now();
  END IF;

  IF OLD.written_review IS DISTINCT FROM NEW.written_review
     OR OLD.overall_rating IS DISTINCT FROM NEW.overall_rating
     OR OLD.display_name IS DISTINCT FROM NEW.display_name THEN
    IF NOT private.is_admin() THEN
      RAISE EXCEPTION 'Reviews are immutable after submit'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_feedback_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Interviewer feedback cannot be updated after submit'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.tg_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate_profile uuid;
  v_interviewer_profile uuid;
  v_from public.booking_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_from := NULL;
    INSERT INTO public.booking_events (booking_id, from_status, to_status, actor_profile_id)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    v_from := OLD.status;
    INSERT INTO public.booking_events (booking_id, from_status, to_status, actor_profile_id, note)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE
        WHEN NEW.status = 'rejected'::public.booking_status THEN NEW.rejection_reason
        WHEN NEW.status = 'rescheduled'::public.booking_status THEN 'replaced_by_new_booking'
        ELSE NULL
      END
    );
  ELSE
    RETURN NEW;
  END IF;

  SELECT cp.profile_id, ip.profile_id
  INTO v_candidate_profile, v_interviewer_profile
  FROM public.candidate_profiles cp, public.interviewer_profiles ip
  WHERE cp.id = NEW.candidate_profile_id
    AND ip.id = NEW.interviewer_profile_id;

  IF NEW.status = 'requested'::public.booking_status THEN
    PERFORM private.notify(
      v_interviewer_profile,
      'booking_requested',
      'New booking request',
      'A candidate booked a slot. Confirm or reject the request.',
      jsonb_build_object('booking_id', NEW.id)
    );
  ELSIF NEW.status = 'confirmed'::public.booking_status THEN
    INSERT INTO public.interview_sessions (booking_id, provider)
    VALUES (NEW.id, 'stub')
    ON CONFLICT (booking_id) DO NOTHING;
    PERFORM private.notify(
      v_candidate_profile,
      'booking_confirmed',
      'Interview confirmed',
      'Your interviewer confirmed the booking.',
      jsonb_build_object('booking_id', NEW.id)
    );
  ELSIF NEW.status = 'rejected'::public.booking_status THEN
    PERFORM private.notify(
      v_candidate_profile,
      'booking_rejected',
      'Booking declined',
      'The interviewer declined this request. A refund will be processed later.',
      jsonb_build_object('booking_id', NEW.id)
    );
  ELSIF NEW.status = 'expired'::public.booking_status THEN
    PERFORM private.notify(
      v_candidate_profile,
      'booking_expired',
      'Payment hold expired',
      'Your unpaid hold expired and the slot was released.',
      jsonb_build_object('booking_id', NEW.id)
    );
  ELSIF NEW.status = 'cancelled'::public.booking_status THEN
    PERFORM private.notify(
      v_candidate_profile,
      'booking_cancelled',
      'Booking cancelled',
      'This interview booking was cancelled.',
      jsonb_build_object('booking_id', NEW.id)
    );
    PERFORM private.notify(
      v_interviewer_profile,
      'booking_cancelled',
      'Booking cancelled',
      'A booking on your calendar was cancelled.',
      jsonb_build_object('booking_id', NEW.id)
    );
  ELSIF NEW.status = 'rescheduled'::public.booking_status THEN
    PERFORM private.notify(
      v_candidate_profile,
      'booking_rescheduled',
      'Interview rescheduled',
      'This booking was replaced by a new time.',
      jsonb_build_object('booking_id', NEW.id)
    );
    PERFORM private.notify(
      v_interviewer_profile,
      'booking_rescheduled',
      'Interview rescheduled',
      'A booking was moved to a new time.',
      jsonb_build_object('booking_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_before ON auth.users;
CREATE TRIGGER on_auth_user_created_before
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user_before();

DROP TRIGGER IF EXISTS on_auth_user_created_after ON auth.users;
CREATE TRIGGER on_auth_user_created_after
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user_after();

CREATE TRIGGER candidate_profiles_single_persona
  BEFORE INSERT ON public.candidate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_single_persona();

CREATE TRIGGER interviewer_profiles_single_persona
  BEFORE INSERT ON public.interviewer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_single_persona();

CREATE TRIGGER profiles_prevent_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_non_admin_role_change();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER candidate_profiles_set_updated_at
  BEFORE UPDATE ON public.candidate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER interviewer_profiles_set_updated_at
  BEFORE UPDATE ON public.interviewer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER interviewer_feedback_set_updated_at
  BEFORE UPDATE ON public.interviewer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER interviewer_verifications_protect
  BEFORE UPDATE ON public.interviewer_verifications
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_verification_status();

CREATE TRIGGER candidate_reviews_protect
  BEFORE INSERT OR UPDATE ON public.candidate_reviews
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_review_moderation();

CREATE TRIGGER interviewer_feedback_immutable
  BEFORE UPDATE ON public.interviewer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_feedback_immutable();

CREATE TRIGGER bookings_status_event
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION private.tg_booking_status();

-- -----------------------------------------------------------------------------
-- 6. Slot generation and booking RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.expire_stale_holds(p_interviewer_profile_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  n integer;
BEGIN
  WITH updated AS (
    UPDATE public.bookings b
    SET status = 'expired'
    WHERE b.status = 'pending_payment'::public.booking_status
      AND b.hold_expires_at IS NOT NULL
      AND b.hold_expires_at <= now()
      AND (
        p_interviewer_profile_id IS NULL
        OR b.interviewer_profile_id = p_interviewer_profile_id
      )
    RETURNING b.id
  ),
  pay AS (
    UPDATE public.payments p
    SET status = 'cancelled'::public.payment_status
    WHERE p.booking_id IN (SELECT id FROM updated)
      AND p.status IN ('created'::public.payment_status, 'pending'::public.payment_status)
    RETURNING p.id
  )
  SELECT (SELECT count(*) FROM updated) INTO n;

  RETURN COALESCE(n, 0);
END;
$$;

CREATE OR REPLACE FUNCTION private.list_bookable_slots(
  p_interviewer_profile_id uuid,
  p_service_id uuid,
  p_from timestamptz DEFAULT now(),
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tz text;
  v_buffer integer;
  v_duration integer;
  v_listed boolean;
  v_active boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_is_owner boolean;
BEGIN
  PERFORM private.expire_stale_holds(p_interviewer_profile_id);

  SELECT ip.timezone, ip.booking_buffer_min, ip.is_listed, p.is_active, s.duration_min
  INTO v_tz, v_buffer, v_listed, v_active, v_duration
  FROM public.interviewer_services s
  JOIN public.interviewer_profiles ip ON ip.id = s.interviewer_profile_id
  JOIN public.profiles p ON p.id = ip.profile_id
  WHERE s.id = p_service_id
    AND s.interviewer_profile_id = p_interviewer_profile_id
    AND s.is_active;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  v_is_owner := private.owns_interviewer_profile(p_interviewer_profile_id) OR private.is_admin();
  IF NOT v_is_owner AND (NOT v_listed OR NOT v_active) THEN
    RETURN;
  END IF;

  v_from := COALESCE(p_from, now());
  v_to := LEAST(
    COALESCE(p_to, v_from + interval '28 days'),
    v_from + interval '28 days'
  );
  IF v_to <= v_from THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH dates AS (
    SELECT d::date AS d
    FROM generate_series(
      (v_from AT TIME ZONE v_tz)::date,
      (v_to AT TIME ZONE v_tz)::date,
      interval '1 day'
    ) AS d
  ),
  windows AS (
    SELECT
      private.wall_tstz(dates.d, a.start_time, v_tz) AS wstart,
      private.wall_tstz(dates.d, a.end_time, v_tz) AS wend
    FROM dates
    JOIN public.interviewer_availability a
      ON a.interviewer_profile_id = p_interviewer_profile_id
     AND a.weekday = EXTRACT(DOW FROM dates.d)::smallint
    UNION ALL
    SELECT
      private.wall_tstz(c.on_date, c.start_time, v_tz),
      private.wall_tstz(c.on_date, c.end_time, v_tz)
    FROM public.interviewer_custom_slots c
    WHERE c.interviewer_profile_id = p_interviewer_profile_id
      AND c.on_date BETWEEN (v_from AT TIME ZONE v_tz)::date AND (v_to AT TIME ZONE v_tz)::date
  ),
  blocked AS (
    SELECT
      CASE
        WHEN b.all_day OR b.start_time IS NULL
          THEN private.wall_tstz(b.on_date, time '00:00', v_tz)
        ELSE private.wall_tstz(b.on_date, b.start_time, v_tz)
      END AS bstart,
      CASE
        WHEN b.all_day OR b.end_time IS NULL
          THEN private.wall_tstz(b.on_date + 1, time '00:00', v_tz)
        ELSE private.wall_tstz(b.on_date, b.end_time, v_tz)
      END AS bend
    FROM public.interviewer_blocked_times b
    WHERE b.interviewer_profile_id = p_interviewer_profile_id
  ),
  occupied AS (
    SELECT
      bk.starts_at,
      bk.ends_at + make_interval(mins => v_buffer) AS occ_end
    FROM public.bookings bk
    WHERE bk.interviewer_profile_id = p_interviewer_profile_id
      AND bk.status IN (
        'pending_payment'::public.booking_status,
        'requested'::public.booking_status,
        'confirmed'::public.booking_status,
        'in_progress'::public.booking_status
      )
  ),
  raw_slots AS (
    SELECT
      gs AS slot_start,
      gs + make_interval(mins => v_duration) AS slot_end
    FROM windows w
    CROSS JOIN LATERAL generate_series(
      w.wstart,
      w.wend - make_interval(mins => v_duration),
      make_interval(mins => v_duration)
    ) AS gs
  )
  SELECT rs.slot_start, rs.slot_end
  FROM raw_slots rs
  WHERE rs.slot_start >= GREATEST(v_from, now())
    AND rs.slot_end <= v_to
    AND NOT EXISTS (
      SELECT 1 FROM blocked b
      WHERE rs.slot_start < b.bend AND b.bstart < rs.slot_end
    )
    AND NOT EXISTS (
      SELECT 1 FROM occupied o
      WHERE rs.slot_start < o.occ_end AND o.starts_at < rs.slot_end
    )
  ORDER BY rs.slot_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_bookable_slots(
  p_interviewer_profile_id uuid,
  p_service_id uuid,
  p_from timestamptz DEFAULT now(),
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
  SELECT s.starts_at, s.ends_at
  FROM private.list_bookable_slots(p_interviewer_profile_id, p_service_id, p_from, p_to) AS s;
$$;

CREATE OR REPLACE FUNCTION public.create_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_display_timezone text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_candidate uuid;
  v_service public.interviewer_services%ROWTYPE;
  v_interviewer public.interviewer_profiles%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_ends timestamptz;
  v_fee integer;
  v_platform integer;
  v_booking public.bookings;
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_candidate := private.current_candidate_profile_id();
  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_service
  FROM public.interviewer_services
  WHERE id = p_service_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'service_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_interviewer
  FROM public.interviewer_profiles
  WHERE id = v_service.interviewer_profile_id
  FOR UPDATE;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_interviewer.profile_id;

  IF NOT v_interviewer.is_listed OR NOT v_profile.is_active THEN
    RAISE EXCEPTION 'interviewer_not_listed' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.expire_stale_holds(v_interviewer.id);

  v_ends := p_starts_at + make_interval(mins => v_service.duration_min);
  v_fee := v_service.price_paise;
  v_platform := private.platform_fee_paise(v_fee);

  SELECT EXISTS (
    SELECT 1
    FROM private.list_bookable_slots(
      v_interviewer.id,
      v_service.id,
      p_starts_at,
      v_ends
    ) s
    WHERE s.starts_at = p_starts_at
      AND s.ends_at = v_ends
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bookings (
    candidate_profile_id,
    interviewer_profile_id,
    service_id,
    status,
    starts_at,
    ends_at,
    display_timezone,
    interviewer_timezone,
    duration_min,
    session_fee_paise,
    platform_fee_paise,
    total_paise,
    currency,
    mode,
    hold_expires_at
  )
  VALUES (
    v_candidate,
    v_interviewer.id,
    v_service.id,
    'pending_payment',
    p_starts_at,
    v_ends,
    COALESCE(NULLIF(p_display_timezone, ''), v_profile.timezone),
    v_interviewer.timezone,
    v_service.duration_min,
    v_fee,
    v_platform,
    v_fee + v_platform,
    v_service.currency,
    'video',
    now() + interval '10 minutes'
  )
  RETURNING * INTO v_booking;

  INSERT INTO public.payments (
    booking_id,
    candidate_profile_id,
    amount_paise,
    platform_fee_paise,
    currency,
    status,
    provider
  )
  VALUES (
    v_booking.id,
    v_candidate,
    v_booking.total_paise,
    v_booking.platform_fee_paise,
    v_booking.currency,
    'created',
    'stub'
  );

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION private.capture_booking_payment(p_booking_id uuid, p_provider_ref text)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  PERFORM private.expire_stale_holds();

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.status = 'expired'::public.booking_status THEN
    RAISE EXCEPTION 'hold_expired' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.status <> 'pending_payment'::public.booking_status THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.hold_expires_at <= now() THEN
    UPDATE public.bookings SET status = 'expired' WHERE id = p_booking_id;
    RAISE EXCEPTION 'hold_expired' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payments
  SET
    status = 'captured'::public.payment_status,
    provider_ref = COALESCE(p_provider_ref, provider_ref)
  WHERE booking_id = p_booking_id;

  UPDATE public.bookings
  SET status = 'requested'::public.booking_status
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_stub_payment(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_payment public.payments;
BEGIN
  IF NOT private.can_read_booking(p_booking_id)
     OR NOT private.owns_candidate_profile(
       (SELECT candidate_profile_id FROM public.bookings WHERE id = p_booking_id)
     ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id;
  IF v_payment.provider IS DISTINCT FROM 'stub' THEN
    RAISE EXCEPTION 'stub_payment_only' USING ERRCODE = '42501';
  END IF;

  RETURN private.capture_booking_payment(p_booking_id, 'stub:' || p_booking_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_payment(p_booking_id uuid, p_provider_ref text DEFAULT NULL)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN private.capture_booking_payment(p_booking_id, p_provider_ref);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_booking(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.owns_interviewer_profile(v_booking.interviewer_profile_id) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'requested'::public.booking_status THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bookings
  SET status = 'confirmed'
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_booking(p_booking_id uuid, p_reason text DEFAULT NULL)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.owns_interviewer_profile(v_booking.interviewer_profile_id) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'requested'::public.booking_status THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bookings
  SET
    status = 'rejected',
    rejection_reason = p_reason
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid, p_note text DEFAULT NULL)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_booking public.bookings;
  v_allowed boolean;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_allowed :=
    private.is_admin()
    OR private.owns_candidate_profile(v_booking.candidate_profile_id)
    OR private.owns_interviewer_profile(v_booking.interviewer_profile_id);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status NOT IN (
    'pending_payment'::public.booking_status,
    'requested'::public.booking_status,
    'confirmed'::public.booking_status
  ) THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  UPDATE public.payments
  SET status = CASE
    WHEN status IN ('created'::public.payment_status, 'pending'::public.payment_status)
      THEN 'cancelled'::public.payment_status
    ELSE status
  END
  WHERE booking_id = p_booking_id
    AND status IN ('created'::public.payment_status, 'pending'::public.payment_status);

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_display_timezone text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_old public.bookings;
  v_new public.bookings;
  v_payment public.payments;
  v_ok boolean;
  v_new_status public.booking_status;
  v_candidate_initiated boolean;
  v_ends_at timestamptz;
  v_moved integer;
BEGIN
  -- Serialize against create_booking / other reschedules for this interviewer.
  SELECT * INTO v_old
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    private.owns_candidate_profile(v_old.candidate_profile_id)
    OR private.owns_interviewer_profile(v_old.interviewer_profile_id)
    OR private.is_admin()
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Retired rows cannot be rescheduled, confirmed, paid, or reused.
  IF v_old.status = 'rescheduled'::public.booking_status
     OR EXISTS (
       SELECT 1
       FROM public.bookings successor
       WHERE successor.rescheduled_from_booking_id = v_old.id
     ) THEN
    RAISE EXCEPTION 'booking_already_rescheduled' USING ERRCODE = 'P0001';
  END IF;

  IF v_old.status NOT IN (
    'requested'::public.booking_status,
    'confirmed'::public.booking_status
  ) THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.interviewer_profiles
  WHERE id = v_old.interviewer_profile_id
  FOR UPDATE;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE booking_id = v_old.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM private.expire_stale_holds(v_old.interviewer_profile_id);

  v_ends_at := p_starts_at + make_interval(mins => v_old.duration_min);

  v_candidate_initiated := private.owns_candidate_profile(v_old.candidate_profile_id)
    AND NOT private.owns_interviewer_profile(v_old.interviewer_profile_id)
    AND NOT private.is_admin();

  -- Candidate must get interviewer confirmation of the new time.
  -- Interviewer-initiated keeps requested or confirmed.
  IF v_candidate_initiated THEN
    v_new_status := 'requested'::public.booking_status;
  ELSE
    v_new_status := v_old.status;
  END IF;

  -- 1. Retire the old row first so its interval is no longer occupying.
  --    Exclusion no longer applies to status = rescheduled.
  --    Trigger writes booking_events: old.status → rescheduled.
  --    If a later step fails, the transaction rolls this back.
  UPDATE public.bookings
  SET
    status = 'rescheduled'::public.booking_status,
    hold_expires_at = NULL
  WHERE id = v_old.id
    AND status = v_old.status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_already_rescheduled' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Revalidate the newly selected slot against availability + remaining bookings.
  SELECT EXISTS (
    SELECT 1
    FROM private.list_bookable_slots(
      v_old.interviewer_profile_id,
      v_old.service_id,
      p_starts_at,
      v_ends_at
    ) s
    WHERE s.starts_at = p_starts_at
      AND s.ends_at = v_ends_at
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Insert the successor on the new slot. Exclusion is the race last-line.
  INSERT INTO public.bookings (
    candidate_profile_id,
    interviewer_profile_id,
    service_id,
    status,
    starts_at,
    ends_at,
    display_timezone,
    interviewer_timezone,
    duration_min,
    session_fee_paise,
    platform_fee_paise,
    total_paise,
    currency,
    mode,
    hold_expires_at,
    rescheduled_from_booking_id
  )
  VALUES (
    v_old.candidate_profile_id,
    v_old.interviewer_profile_id,
    v_old.service_id,
    v_new_status,
    p_starts_at,
    v_ends_at,
    COALESCE(NULLIF(p_display_timezone, ''), v_old.display_timezone),
    v_old.interviewer_timezone,
    v_old.duration_min,
    v_old.session_fee_paise,
    v_old.platform_fee_paise,
    v_old.total_paise,
    v_old.currency,
    v_old.mode,
    NULL,
    v_old.id
  )
  RETURNING * INTO v_new;

  -- Trigger writes booking_events: NULL → requested|confirmed on the new row.

  -- 4. Move the existing captured payment onto the successor (UNIQUE booking_id).
  UPDATE public.payments
  SET booking_id = v_new.id
  WHERE id = v_payment.id
    AND booking_id = v_old.id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  IF v_moved <> 1 THEN
    RAISE EXCEPTION 'payment_move_failed' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_interviewer_feedback(
  p_booking_id uuid,
  p_technical_skills smallint,
  p_problem_solving smallint,
  p_communication smallint,
  p_overall smallint,
  p_strengths text[],
  p_improvements text[],
  p_summary text,
  p_readiness public.readiness_level,
  p_system_design smallint DEFAULT NULL,
  p_coding smallint DEFAULT NULL,
  p_behavioral smallint DEFAULT NULL,
  p_internal_notes text DEFAULT NULL
)
RETURNS public.interviewer_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_booking public.bookings;
  v_row public.interviewer_feedback;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.owns_interviewer_profile(v_booking.interviewer_profile_id) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'completed'::public.booking_status THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.interviewer_feedback (
    booking_id,
    interviewer_profile_id,
    candidate_profile_id,
    technical_skills,
    problem_solving,
    communication,
    system_design,
    coding,
    behavioral,
    overall,
    strengths,
    improvements,
    summary,
    readiness,
    internal_notes
  )
  VALUES (
    v_booking.id,
    v_booking.interviewer_profile_id,
    v_booking.candidate_profile_id,
    p_technical_skills,
    p_problem_solving,
    p_communication,
    p_system_design,
    p_coding,
    p_behavioral,
    p_overall,
    COALESCE(p_strengths, '{}'),
    COALESCE(p_improvements, '{}'),
    p_summary,
    p_readiness,
    p_internal_notes
  )
  RETURNING * INTO v_row;

  PERFORM private.notify(
    (SELECT profile_id FROM public.candidate_profiles WHERE id = v_booking.candidate_profile_id),
    'feedback_ready',
    'Interview feedback is ready',
    'Your interviewer submitted private feedback for this session.',
    jsonb_build_object('booking_id', v_booking.id)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_candidate_review(
  p_booking_id uuid,
  p_overall_rating smallint,
  p_technical_expertise smallint,
  p_communication smallint,
  p_interview_realism smallint,
  p_feedback_quality smallint,
  p_professionalism smallint,
  p_recommend public.recommend_level,
  p_written_review text,
  p_show_name_publicly boolean DEFAULT false
)
RETURNS public.candidate_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_booking public.bookings;
  v_name text;
  v_row public.candidate_reviews;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.owns_candidate_profile(v_booking.candidate_profile_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'completed'::public.booking_status THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.full_name INTO v_name
  FROM public.profiles p
  JOIN public.candidate_profiles cp ON cp.profile_id = p.id
  WHERE cp.id = v_booking.candidate_profile_id;

  INSERT INTO public.candidate_reviews (
    booking_id,
    interviewer_profile_id,
    candidate_profile_id,
    overall_rating,
    technical_expertise,
    communication,
    interview_realism,
    feedback_quality,
    professionalism,
    recommend,
    written_review,
    show_name_publicly,
    display_name,
    moderation_status
  )
  VALUES (
    v_booking.id,
    v_booking.interviewer_profile_id,
    v_booking.candidate_profile_id,
    p_overall_rating,
    p_technical_expertise,
    p_communication,
    p_interview_realism,
    p_feedback_quality,
    p_professionalism,
    p_recommend,
    p_written_review,
    COALESCE(p_show_name_publicly, false),
    private.review_display_name(v_name, COALESCE(p_show_name_publicly, false)),
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_candidate_review(
  p_review_id uuid,
  p_status public.moderation_status
)
RETURNS public.candidate_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_row public.candidate_reviews;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved'::public.moderation_status, 'rejected'::public.moderation_status) THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.candidate_reviews
  SET moderation_status = p_status
  WHERE id = p_review_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_holds()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
  SELECT private.expire_stale_holds(NULL);
$$;

-- -----------------------------------------------------------------------------
-- 7. Views (definer): public directory, public reviews, candidate feedback
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.interviewer_public_directory
WITH (security_invoker = false) AS
SELECT
  ip.id AS interviewer_profile_id,
  p.full_name,
  p.avatar_url,
  ip.headline,
  ip.bio,
  ip."current_role",
  ip.company,
  ip.experience_years,
  ip.timezone,
  ip.languages,
  ip.list_price_paise,
  ip.currency,
  ip.is_online,
  (
    SELECT ROUND(AVG(cr.overall_rating)::numeric, 1)
    FROM public.candidate_reviews cr
    WHERE cr.interviewer_profile_id = ip.id
      AND cr.moderation_status = 'approved'::public.moderation_status
  ) AS rating_avg,
  (
    SELECT COUNT(*)::integer
    FROM public.candidate_reviews cr
    WHERE cr.interviewer_profile_id = ip.id
      AND cr.moderation_status = 'approved'::public.moderation_status
  ) AS review_count,
  (
    SELECT COUNT(*)::integer
    FROM public.bookings b
    WHERE b.interviewer_profile_id = ip.id
      AND b.status = 'completed'::public.booking_status
  ) AS completed_interviews_count,
  EXISTS (
    SELECT 1 FROM public.interviewer_verifications v
    WHERE v.interviewer_profile_id = ip.id
      AND v.kind = 'identity'::public.verification_kind
      AND v.status = 'verified'::public.verification_status
  ) AS identity_verified,
  EXISTS (
    SELECT 1 FROM public.interviewer_verifications v
    WHERE v.interviewer_profile_id = ip.id
      AND v.kind = 'employment'::public.verification_kind
      AND v.status = 'verified'::public.verification_status
  ) AS employment_verified,
  EXISTS (
    SELECT 1 FROM public.interviewer_verifications v
    WHERE v.interviewer_profile_id = ip.id
      AND v.kind = 'linkedin'::public.verification_kind
      AND v.status = 'verified'::public.verification_status
  ) AS linkedin_verified
FROM public.interviewer_profiles ip
JOIN public.profiles p ON p.id = ip.profile_id
WHERE ip.is_listed
  AND p.is_active;

CREATE OR REPLACE VIEW public.interviewer_services_public
WITH (security_invoker = false) AS
SELECT
  s.id,
  s.interviewer_profile_id,
  s.name,
  s.interview_type,
  s.duration_min,
  s.price_paise,
  s.currency,
  s.description
FROM public.interviewer_services s
JOIN public.interviewer_profiles ip ON ip.id = s.interviewer_profile_id
JOIN public.profiles p ON p.id = ip.profile_id
WHERE s.is_active
  AND ip.is_listed
  AND p.is_active;

CREATE OR REPLACE VIEW public.interviewer_skills_public
WITH (security_invoker = false) AS
SELECT sk.id, sk.interviewer_profile_id, sk.skill
FROM public.interviewer_skills sk
JOIN public.interviewer_profiles ip ON ip.id = sk.interviewer_profile_id
JOIN public.profiles p ON p.id = ip.profile_id
WHERE ip.is_listed AND p.is_active;

CREATE OR REPLACE VIEW public.interviewer_roles_public
WITH (security_invoker = false) AS
SELECT r.id, r.interviewer_profile_id, r.target_role, r.candidate_level
FROM public.interviewer_roles r
JOIN public.interviewer_profiles ip ON ip.id = r.interviewer_profile_id
JOIN public.profiles p ON p.id = ip.profile_id
WHERE ip.is_listed AND p.is_active;

CREATE OR REPLACE VIEW public.candidate_reviews_public
WITH (security_invoker = false) AS
SELECT
  cr.id,
  cr.interviewer_profile_id,
  cr.display_name,
  cr.overall_rating,
  cr.technical_expertise,
  cr.communication,
  cr.interview_realism,
  cr.feedback_quality,
  cr.professionalism,
  cr.recommend,
  cr.written_review,
  cr.created_at
FROM public.candidate_reviews cr
WHERE cr.moderation_status = 'approved'::public.moderation_status;

CREATE OR REPLACE VIEW public.interviewer_feedback_for_candidate
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  f.id,
  f.booking_id,
  f.interviewer_profile_id,
  f.candidate_profile_id,
  f.technical_skills,
  f.problem_solving,
  f.communication,
  f.system_design,
  f.coding,
  f.behavioral,
  f.overall,
  f.strengths,
  f.improvements,
  f.summary,
  f.readiness,
  f.created_at
FROM public.interviewer_feedback f
WHERE private.owns_candidate_profile(f.candidate_profile_id)
   OR private.is_admin();

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_custom_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.candidate_profiles cp ON cp.id = b.candidate_profile_id
      JOIN public.interviewer_profiles ip ON ip.id = b.interviewer_profile_id
      WHERE (cp.profile_id = auth.uid() AND ip.profile_id = profiles.id)
         OR (ip.profile_id = auth.uid() AND cp.profile_id = profiles.id)
    )
  );

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_admin())
  WITH CHECK (id = auth.uid() OR private.is_admin());

CREATE POLICY candidate_profiles_crud ON public.candidate_profiles
  FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR private.is_admin())
  WITH CHECK (profile_id = auth.uid() OR private.is_admin());

CREATE POLICY candidate_preferences_crud ON public.candidate_preferences
  FOR ALL TO authenticated
  USING (
    private.owns_candidate_profile(candidate_profile_id) OR private.is_admin()
  )
  WITH CHECK (
    private.owns_candidate_profile(candidate_profile_id) OR private.is_admin()
  );

CREATE POLICY candidate_skills_crud ON public.candidate_skills
  FOR ALL TO authenticated
  USING (
    private.owns_candidate_profile(candidate_profile_id) OR private.is_admin()
  )
  WITH CHECK (
    private.owns_candidate_profile(candidate_profile_id) OR private.is_admin()
  );

CREATE POLICY interviewer_profiles_select ON public.interviewer_profiles
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR private.is_admin());

CREATE POLICY interviewer_profiles_update ON public.interviewer_profiles
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR private.is_admin())
  WITH CHECK (profile_id = auth.uid() OR private.is_admin());

CREATE POLICY interviewer_profiles_insert ON public.interviewer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() OR private.is_admin());

CREATE POLICY interviewer_skills_crud ON public.interviewer_skills
  FOR ALL TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY interviewer_roles_crud ON public.interviewer_roles
  FOR ALL TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY interviewer_services_crud ON public.interviewer_services
  FOR ALL TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY interviewer_availability_crud ON public.interviewer_availability
  FOR ALL TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY interviewer_custom_slots_crud ON public.interviewer_custom_slots
  FOR ALL TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY interviewer_blocked_times_crud ON public.interviewer_blocked_times
  FOR ALL TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY interviewer_verifications_select ON public.interviewer_verifications
  FOR SELECT TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY interviewer_verifications_insert ON public.interviewer_verifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (private.owns_interviewer_profile(interviewer_profile_id) AND status = 'pending'::public.verification_status)
    OR private.is_admin()
  );

CREATE POLICY interviewer_verifications_update ON public.interviewer_verifications
  FOR UPDATE TO authenticated
  USING (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin());

CREATE POLICY bookings_select ON public.bookings
  FOR SELECT TO authenticated
  USING (
    private.owns_candidate_profile(candidate_profile_id)
    OR private.owns_interviewer_profile(interviewer_profile_id)
    OR private.is_admin()
  );

CREATE POLICY booking_events_select ON public.booking_events
  FOR SELECT TO authenticated
  USING (private.can_read_booking(booking_id));

CREATE POLICY interview_sessions_select ON public.interview_sessions
  FOR SELECT TO authenticated
  USING (private.can_read_booking(booking_id));

CREATE POLICY session_events_select ON public.session_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_sessions s
      WHERE s.id = session_id
        AND private.can_read_booking(s.booking_id)
    )
  );

CREATE POLICY interviewer_feedback_select ON public.interviewer_feedback
  FOR SELECT TO authenticated
  USING (
    private.owns_interviewer_profile(interviewer_profile_id)
    OR private.is_admin()
  );

CREATE POLICY interviewer_feedback_insert ON public.interviewer_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    private.owns_interviewer_profile(interviewer_profile_id) OR private.is_admin()
  );

CREATE POLICY candidate_reviews_select ON public.candidate_reviews
  FOR SELECT TO authenticated
  USING (
    private.owns_candidate_profile(candidate_profile_id)
    OR private.owns_interviewer_profile(interviewer_profile_id)
    OR private.is_admin()
  );

CREATE POLICY candidate_reviews_insert ON public.candidate_reviews
  FOR INSERT TO authenticated
  WITH CHECK (private.owns_candidate_profile(candidate_profile_id));

CREATE POLICY candidate_reviews_update_admin ON public.candidate_reviews
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (
    private.owns_candidate_profile(candidate_profile_id) OR private.is_admin()
  );

CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR private.is_admin());

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR private.is_admin())
  WITH CHECK (profile_id = auth.uid() OR private.is_admin());

CREATE POLICY notification_preferences_crud ON public.notification_preferences
  FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR private.is_admin())
  WITH CHECK (profile_id = auth.uid() OR private.is_admin());

-- -----------------------------------------------------------------------------
-- 9. Grants / revokes
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE
  public.profiles,
  public.candidate_profiles,
  public.candidate_preferences,
  public.candidate_skills,
  public.interviewer_profiles,
  public.interviewer_skills,
  public.interviewer_roles,
  public.interviewer_services,
  public.interviewer_availability,
  public.interviewer_custom_slots,
  public.interviewer_blocked_times,
  public.interviewer_verifications,
  public.bookings,
  public.booking_events,
  public.interview_sessions,
  public.session_events,
  public.interviewer_feedback,
  public.candidate_reviews,
  public.payments,
  public.notifications,
  public.notification_preferences
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.interviewer_public_directory FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interviewer_services_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interviewer_skills_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interviewer_roles_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.candidate_reviews_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interviewer_feedback_for_candidate FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.list_bookable_slots(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking(uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_stub_payment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_payment(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_booking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_booking(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_booking(uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_interviewer_feedback(uuid, smallint, smallint, smallint, smallint, text[], text[], text, public.readiness_level, smallint, smallint, smallint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_candidate_review(uuid, smallint, smallint, smallint, smallint, smallint, smallint, public.recommend_level, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.moderate_candidate_review(uuid, public.moderation_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_holds() FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.interviewer_public_directory TO anon, authenticated;
GRANT SELECT ON public.interviewer_services_public TO anon, authenticated;
GRANT SELECT ON public.interviewer_skills_public TO anon, authenticated;
GRANT SELECT ON public.interviewer_roles_public TO anon, authenticated;
GRANT SELECT ON public.candidate_reviews_public TO anon, authenticated;
GRANT SELECT ON public.interviewer_feedback_for_candidate TO authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.interviewer_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviewer_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviewer_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviewer_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviewer_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviewer_custom_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviewer_blocked_times TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.interviewer_verifications TO authenticated;
GRANT SELECT ON public.bookings TO authenticated;
GRANT SELECT ON public.booking_events TO authenticated;
GRANT SELECT ON public.interview_sessions TO authenticated;
GRANT SELECT ON public.session_events TO authenticated;
GRANT SELECT, INSERT ON public.interviewer_feedback TO authenticated;
GRANT SELECT, INSERT ON public.candidate_reviews TO authenticated;
GRANT UPDATE ON public.candidate_reviews TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;

GRANT EXECUTE ON FUNCTION public.list_bookable_slots(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stub_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_interviewer_feedback(uuid, smallint, smallint, smallint, smallint, text[], text[], text, public.readiness_level, smallint, smallint, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_candidate_review(uuid, smallint, smallint, smallint, smallint, smallint, smallint, public.recommend_level, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_candidate_review(uuid, public.moderation_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_payment(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_holds() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.expire_stale_holds(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.platform_fee_paise(integer) TO postgres, service_role, authenticated;

REVOKE ALL ON FUNCTION public.capture_payment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_holds() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. Cron: expire stale payment holds every minute
-- -----------------------------------------------------------------------------

SELECT cron.schedule(
  'expire-stale-booking-holds',
  '* * * * *',
  $$SELECT private.expire_stale_holds()$$
);

-- Admin seed is NOT in this migration. See supabase/seeds/admin_seed.sql.
-- Do not apply this file until the SQL is explicitly approved.

-- Admin seed is NOT in this migration. See supabase/seeds/admin_seed.sql.
-- Do not apply this file until it is explicitly approved.
