-- Rolls back. A successful run raises probe_passed and leaves no rows behind.
-- Covers skill-only matching, canonical duplicates, preferred dates, slot gating, and account deletion isolation.

DO $probe$
DECLARE
  v_instance uuid;
  v_candidate uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_plain uuid := gen_random_uuid();
  v_with_service uuid := gen_random_uuid();
  v_candidate_a uuid;
  v_candidate_b uuid;
  v_plain_profile uuid;
  v_service_profile uuid;
  v_service uuid;
  v_booking uuid;
  v_match_count integer;
  v_plain_hit integer;
  v_service_hit integer;
  v_min_ratio numeric;
  v_max_ratio numeric;
  v_comma_ratio numeric;
  v_comma_matched text[];
  v_comma_missing text[];
  v_create_booking text;
BEGIN
  SELECT COALESCE(
    (SELECT id FROM auth.instances LIMIT 1),
    (SELECT instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1)
  )
  INTO v_instance;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (
      v_instance, v_candidate, 'authenticated', 'authenticated',
      'probe-a-' || v_candidate::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb,
      '{"full_name":"Probe A"}'::jsonb, now(), now()
    ),
    (
      v_instance, v_other, 'authenticated', 'authenticated',
      'probe-b-' || v_other::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb,
      '{"full_name":"Probe B"}'::jsonb, now(), now()
    ),
    (
      v_instance, v_plain, 'authenticated', 'authenticated',
      'probe-plain-' || v_plain::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"interviewer"}'::jsonb,
      '{"full_name":"Probe Plain"}'::jsonb, now(), now()
    ),
    (
      v_instance, v_with_service, 'authenticated', 'authenticated',
      'probe-svc-' || v_with_service::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"interviewer"}'::jsonb,
      '{"full_name":"Probe Service"}'::jsonb, now(), now()
    );

  SELECT id INTO v_candidate_a FROM public.candidate_profiles WHERE profile_id = v_candidate;
  SELECT id INTO v_candidate_b FROM public.candidate_profiles WHERE profile_id = v_other;
  SELECT id INTO v_plain_profile FROM public.interviewer_profiles WHERE profile_id = v_plain;
  SELECT id INTO v_service_profile FROM public.interviewer_profiles WHERE profile_id = v_with_service;

  IF v_candidate_a IS NULL OR v_candidate_b IS NULL OR v_plain_profile IS NULL OR v_service_profile IS NULL THEN
    RAISE EXCEPTION 'probe_setup_failed';
  END IF;

  IF private.canonical_skill_key('Python 3') IS DISTINCT FROM 'python'
    OR private.canonical_skill_key('ML') IS DISTINCT FROM 'machine learning'
    OR private.canonical_skill_key('PowerBI') IS DISTINCT FROM 'power bi' THEN
    RAISE EXCEPTION 'probe_canonical_failed';
  END IF;

  IF position('interviewer_services' IN pg_get_functiondef('public.match_interviewers_by_skills(text[])'::regprocedure)) <> 0 THEN
    RAISE EXCEPTION 'probe_rpc_mentions_services';
  END IF;

  INSERT INTO public.candidate_skills (candidate_profile_id, skill)
  VALUES (v_candidate_a, 'Python'), (v_candidate_b, 'Python');

  BEGIN
    INSERT INTO public.candidate_skills (candidate_profile_id, skill)
    VALUES (v_candidate_a, 'Python 3');
    RAISE EXCEPTION 'probe_duplicate_not_blocked';
  EXCEPTION
    WHEN SQLSTATE '23505' THEN
      NULL;
  END;

  UPDATE public.candidate_skills
  SET skill = 'Python 3'
  WHERE candidate_profile_id = v_candidate_a
    AND skill = 'Python';

  IF NOT EXISTS (
    SELECT 1 FROM public.candidate_skills
    WHERE candidate_profile_id = v_candidate_a AND skill = 'Python 3'
  ) THEN
    RAISE EXCEPTION 'probe_edit_failed';
  END IF;

  DELETE FROM public.candidate_skills
  WHERE candidate_profile_id = v_candidate_a
    AND skill = 'Python 3';

  IF EXISTS (
    SELECT 1 FROM public.candidate_skills WHERE candidate_profile_id = v_candidate_a
  ) OR NOT EXISTS (
    SELECT 1 FROM public.candidate_skills
    WHERE candidate_profile_id = v_candidate_b AND skill = 'Python'
  ) THEN
    RAISE EXCEPTION 'probe_delete_touched_other_candidate';
  END IF;

  INSERT INTO public.candidate_skills (candidate_profile_id, skill)
  VALUES (v_candidate_a, 'Probeonly Skill');

  INSERT INTO public.interviewer_skills (interviewer_profile_id, skill)
  VALUES
    (v_plain_profile, 'Python'),
    (v_plain_profile, 'Machine Learning'),
    (v_plain_profile, 'Probeonly Skill'),
    (v_service_profile, 'Python'),
    (v_service_profile, 'Machine Learning'),
    (v_service_profile, 'Probeonly Skill');

  IF EXISTS (
    SELECT 1 FROM public.interviewer_services
    WHERE interviewer_profile_id = v_plain_profile
  ) THEN
    RAISE EXCEPTION 'probe_plain_has_service';
  END IF;

  INSERT INTO public.interviewer_services (
    interviewer_profile_id, name, interview_type, duration_min, price_paise
  )
  VALUES (v_service_profile, 'Probe session', 'Technical', 60, 100000)
  RETURNING id INTO v_service;

  PERFORM set_config('request.jwt.claim.sub', v_candidate::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_candidate, 'role', 'authenticated')::text,
    true
  );

  SELECT COUNT(*)::integer,
    COUNT(*) FILTER (WHERE interviewer_profile_id = v_plain_profile)::integer,
    COUNT(*) FILTER (WHERE interviewer_profile_id = v_service_profile)::integer,
    MIN(skill_ratio) FILTER (WHERE interviewer_profile_id IN (v_plain_profile, v_service_profile)),
    MAX(skill_ratio) FILTER (WHERE interviewer_profile_id IN (v_plain_profile, v_service_profile))
  INTO v_match_count, v_plain_hit, v_service_hit, v_min_ratio, v_max_ratio
  FROM public.match_interviewers_by_skills(ARRAY['Python', 'ML', 'Probeonly Skill']);

  IF v_plain_hit <> 1 OR v_service_hit <> 1 THEN
    RAISE EXCEPTION 'probe_match_missing';
  END IF;

  IF v_min_ratio IS DISTINCT FROM 1 OR v_max_ratio IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'probe_score_mismatch';
  END IF;

  IF v_match_count < 2 THEN
    RAISE EXCEPTION 'probe_match_count';
  END IF;

  INSERT INTO public.interviewer_skills (interviewer_profile_id, skill)
  VALUES (v_plain_profile, 'Machine Learning, Deep Learning, Pandas');

  SELECT skill_ratio, matched_skills, missing_candidate_skills
  INTO v_comma_ratio, v_comma_matched, v_comma_missing
  FROM public.match_interviewers_by_skills(ARRAY['Machine Learning', 'Deep Learning', 'Pandas'])
  WHERE interviewer_profile_id = v_plain_profile;

  IF v_comma_ratio IS DISTINCT FROM 1
    OR v_comma_matched IS DISTINCT FROM ARRAY['Machine Learning', 'Deep Learning', 'Pandas']::text[]
    OR cardinality(v_comma_missing) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'probe_comma_skill_mismatch';
  END IF;

  IF position('skill_phrases' IN pg_get_functiondef('public.match_interviewers_by_skills(text[])'::regprocedure)) = 0
    OR position('interviewer_services' IN pg_get_functiondef('public.match_interviewers_by_skills(text[])'::regprocedure)) <> 0
    OR position('interviewer_availability' IN pg_get_functiondef('public.match_interviewers_by_skills(text[])'::regprocedure)) <> 0 THEN
    RAISE EXCEPTION 'probe_match_definition';
  END IF;

  UPDATE public.candidate_preferences
  SET preferred_date = DATE '2026-10-01',
      preferred_end_date = DATE '2026-10-15'
  WHERE candidate_profile_id = v_candidate_a;

  BEGIN
    UPDATE public.candidate_preferences
    SET preferred_end_date = DATE '2026-09-01'
    WHERE candidate_profile_id = v_candidate_a;
    RAISE EXCEPTION 'probe_range_check_missing';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.bookings (
      candidate_profile_id, interviewer_profile_id, service_id, status,
      starts_at, ends_at, display_timezone, interviewer_timezone,
      duration_min, session_fee_paise, platform_fee_paise, total_paise, hold_expires_at
    )
    VALUES (
      v_candidate_a, v_service_profile, v_service, 'pending_payment',
      '2026-10-20 04:30:00+00', '2026-10-20 05:30:00+00', 'Asia/Kolkata', 'Asia/Kolkata',
      60, 100000, 0, 100000, now() + interval '1 day'
    );
    RAISE EXCEPTION 'probe_outside_range_allowed';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM NOT LIKE '%outside_preferred_dates%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.bookings (
    candidate_profile_id, interviewer_profile_id, service_id, status,
    starts_at, ends_at, display_timezone, interviewer_timezone,
    duration_min, session_fee_paise, platform_fee_paise, total_paise, hold_expires_at
  )
  VALUES (
    v_candidate_a, v_service_profile, v_service, 'pending_payment',
    '2026-10-10 04:30:00+00', '2026-10-10 05:30:00+00', 'Asia/Kolkata', 'Asia/Kolkata',
    60, 100000, 0, 100000, now() + interval '1 day'
  )
  RETURNING id INTO v_booking;

  SELECT pg_get_functiondef(p.oid)
  INTO v_create_booking
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_booking';

  IF v_create_booking IS NULL
    OR position('list_bookable_slots' IN v_create_booking) = 0
    OR position('slot_unavailable' IN v_create_booking) = 0 THEN
    RAISE EXCEPTION 'probe_booking_slot_gate_missing';
  END IF;

  PERFORM public.delete_my_candidate_account();

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_candidate)
    OR EXISTS (SELECT 1 FROM public.candidate_profiles WHERE id = v_candidate_a)
    OR EXISTS (SELECT 1 FROM public.candidate_skills WHERE candidate_profile_id = v_candidate_a)
    OR EXISTS (SELECT 1 FROM auth.users WHERE id = v_candidate) THEN
    RAISE EXCEPTION 'probe_delete_incomplete';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_other)
    OR NOT EXISTS (
      SELECT 1 FROM public.candidate_skills
      WHERE candidate_profile_id = v_candidate_b AND skill = 'Python'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.interviewer_skills
      WHERE interviewer_profile_id = v_plain_profile AND skill = 'Probeonly Skill'
    )
    OR NOT EXISTS (SELECT 1 FROM public.interviewer_profiles WHERE id = v_service_profile)
    OR NOT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE id = v_booking
        AND candidate_profile_id IS NULL
        AND status = 'cancelled'
    ) THEN
    RAISE EXCEPTION 'probe_delete_hit_other_user';
  END IF;

  RAISE EXCEPTION 'probe_passed';
END
$probe$;
