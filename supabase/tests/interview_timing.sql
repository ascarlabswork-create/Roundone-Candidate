-- Rolls back. A successful run raises probe_passed and leaves no rows behind.
-- Server time is now(). The cases move bookings.starts_at and bookings.ends_at around it.

DO $probe$
DECLARE
  v_instance uuid;
  v_candidate uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_interviewer uuid := gen_random_uuid();
  v_candidate_profile uuid;
  v_interviewer_profile uuid;
  v_service uuid;
  v_booking uuid;
  v_session uuid;
  v_successor uuid;
  v_successor_session uuid;
  v_ends timestamptz;
  v_status public.booking_status;
  v_provider text;
  v_def text;
  v_access jsonb;
BEGIN
  v_def := pg_get_functiondef('private.interview_call_context(uuid,uuid)'::regprocedure)
    || pg_get_functiondef('private.interview_call_access(uuid,uuid)'::regprocedure);
  IF position('starts_at - interval ''15 minutes''' IN v_def) <> 0
     OR position('ends_at + interval ''30 minutes''' IN v_def) <> 0
     OR position('starts_at - interval ''30 minutes''' IN v_def) = 0
     OR position('starts_at + interval ''15 minutes''' IN v_def) = 0
     OR position('join_window_closed' IN v_def) = 0
     OR position('join_deadline' IN v_def) = 0 THEN
    RAISE EXCEPTION 'probe_window_definition';
  END IF;

  IF has_function_privilege('anon', 'private.interview_call_context(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.interview_call_context(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.prepare_interview_call(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'probe_privileges';
  END IF;

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
      'probe-time-c-' || v_candidate::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb,
      '{"full_name":"Probe Time"}'::jsonb, now(), now()
    ),
    (
      v_instance, v_other, 'authenticated', 'authenticated',
      'probe-time-o-' || v_other::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb,
      '{"full_name":"Probe Other"}'::jsonb, now(), now()
    ),
    (
      v_instance, v_interviewer, 'authenticated', 'authenticated',
      'probe-time-i-' || v_interviewer::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"interviewer"}'::jsonb,
      '{"full_name":"Probe Interviewer"}'::jsonb, now(), now()
    );

  SELECT id INTO v_candidate_profile FROM public.candidate_profiles WHERE profile_id = v_candidate;
  SELECT id INTO v_interviewer_profile FROM public.interviewer_profiles WHERE profile_id = v_interviewer;
  IF v_candidate_profile IS NULL OR v_interviewer_profile IS NULL THEN
    RAISE EXCEPTION 'probe_setup_failed';
  END IF;

  INSERT INTO public.interviewer_services (
    interviewer_profile_id, name, interview_type, duration_min, price_paise
  )
  VALUES (v_interviewer_profile, 'Probe timing', 'Technical', 30, 100000)
  RETURNING id INTO v_service;

  INSERT INTO public.bookings (
    candidate_profile_id, interviewer_profile_id, service_id, status,
    starts_at, ends_at, display_timezone, interviewer_timezone,
    duration_min, session_fee_paise, platform_fee_paise, total_paise
  )
  VALUES (
    v_candidate_profile, v_interviewer_profile, v_service, 'confirmed',
    now() + interval '1 day', now() + interval '1 day 30 minutes',
    'Asia/Kolkata', 'Asia/Kolkata', 30, 100000, 0, 100000
  )
  RETURNING id INTO v_booking;

  SELECT id INTO v_session FROM public.interview_sessions WHERE booking_id = v_booking;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'probe_session_missing';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_candidate::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_candidate, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    PERFORM public.prepare_interview_call(v_booking, NULL);
    RAISE EXCEPTION 'probe_day_early_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%interview_not_started%' THEN
        RAISE;
      END IF;
  END;

  SELECT status INTO v_status FROM public.bookings WHERE id = v_booking;
  IF v_status IS DISTINCT FROM 'confirmed'::public.booking_status THEN
    RAISE EXCEPTION 'probe_acceptance_started_call';
  END IF;

  UPDATE public.bookings
  SET starts_at = now() + interval '20 minutes',
      ends_at = now() + interval '50 minutes'
  WHERE id = v_booking;

  BEGIN
    PERFORM private.interview_call_context(v_booking, NULL);
    RAISE EXCEPTION 'probe_lobby_allowed_token';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%interview_not_started%' THEN
        RAISE;
      END IF;
  END;

  UPDATE public.bookings
  SET starts_at = now() - interval '1 second',
      ends_at = now() + interval '30 minutes'
  WHERE id = v_booking;

  v_access := private.interview_call_context(v_booking, NULL);
  IF (v_access->>'session_id')::uuid IS DISTINCT FROM v_session
     OR v_access->>'role' IS DISTINCT FROM 'candidate' THEN
    RAISE EXCEPTION 'probe_start_denied';
  END IF;

  v_ends := now() - interval '10 minutes';
  UPDATE public.bookings
  SET starts_at = v_ends,
      ends_at = v_ends + interval '30 minutes'
  WHERE id = v_booking;
  v_access := private.interview_call_context(v_booking, NULL);
  IF v_access->>'booking_id' IS NULL THEN
    RAISE EXCEPTION 'probe_late_join_denied';
  END IF;
  IF (SELECT starts_at FROM public.bookings WHERE id = v_booking) IS DISTINCT FROM v_ends
     OR (SELECT ends_at FROM public.bookings WHERE id = v_booking) IS DISTINCT FROM v_ends + interval '30 minutes' THEN
    RAISE EXCEPTION 'probe_late_join_moved_end';
  END IF;

  UPDATE public.bookings
  SET starts_at = now() - interval '16 minutes',
      ends_at = now() + interval '14 minutes'
  WHERE id = v_booking;

  BEGIN
    PERFORM private.interview_call_context(NULL, v_session);
    RAISE EXCEPTION 'probe_deadline_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%join_window_closed%' THEN
        RAISE;
      END IF;
  END;

  IF (SELECT ends_at - starts_at FROM public.bookings WHERE id = v_booking) IS DISTINCT FROM interval '30 minutes' THEN
    RAISE EXCEPTION 'probe_deadline_moved_end';
  END IF;

  UPDATE public.bookings
  SET status = 'in_progress'
  WHERE id = v_booking;
  v_access := private.interview_call_context(v_booking, v_session);
  IF v_access->>'session_id' IS NULL THEN
    RAISE EXCEPTION 'probe_reconnect_denied';
  END IF;

  UPDATE public.bookings
  SET ends_at = now() - interval '1 second'
  WHERE id = v_booking;
  BEGIN
    PERFORM private.interview_call_context(v_booking, NULL);
    RAISE EXCEPTION 'probe_after_end_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%session_expired%' THEN
        RAISE;
      END IF;
  END;

  UPDATE public.bookings
  SET status = 'cancelled',
      starts_at = now() - interval '1 second',
      ends_at = now() + interval '29 minutes'
  WHERE id = v_booking;
  BEGIN
    PERFORM private.interview_call_context(v_booking, NULL);
    RAISE EXCEPTION 'probe_cancelled_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%booking_not_confirmed%' THEN
        RAISE;
      END IF;
  END;

  UPDATE public.bookings
  SET status = 'rescheduled',
      starts_at = now() - interval '1 second',
      ends_at = now() + interval '29 minutes'
  WHERE id = v_booking;
  BEGIN
    PERFORM private.interview_call_context(v_booking, NULL);
    RAISE EXCEPTION 'probe_old_schedule_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%booking_not_confirmed%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.bookings (
    candidate_profile_id, interviewer_profile_id, service_id, status,
    starts_at, ends_at, display_timezone, interviewer_timezone,
    duration_min, session_fee_paise, platform_fee_paise, total_paise,
    rescheduled_from_booking_id
  )
  VALUES (
    v_candidate_profile, v_interviewer_profile, v_service, 'confirmed',
    now() + interval '2 days', now() + interval '2 days 30 minutes',
    'Asia/Kolkata', 'Asia/Kolkata', 30, 100000, 0, 100000,
    v_booking
  )
  RETURNING id INTO v_successor;

  SELECT id INTO v_successor_session FROM public.interview_sessions WHERE booking_id = v_successor;
  BEGIN
    PERFORM private.interview_call_context(v_successor, NULL);
    RAISE EXCEPTION 'probe_new_schedule_early_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%interview_not_started%' THEN
        RAISE;
      END IF;
  END;

  UPDATE public.bookings
  SET starts_at = now() - interval '1 second',
      ends_at = now() + interval '30 minutes'
  WHERE id = v_successor;
  v_access := public.prepare_interview_call(v_successor, v_successor_session);
  IF (v_access->>'session_id')::uuid IS DISTINCT FROM v_successor_session THEN
    RAISE EXCEPTION 'probe_new_schedule_denied';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.prepare_interview_call(v_successor, NULL);
    RAISE EXCEPTION 'probe_stranger_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%not_authorized%' THEN
        RAISE;
      END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_candidate::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_candidate, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.begin_interview_call(v_successor_session);
  SELECT status INTO v_status FROM public.bookings WHERE id = v_successor;
  SELECT provider INTO v_provider FROM public.interview_sessions WHERE id = v_successor_session;
  IF v_status IS DISTINCT FROM 'in_progress'::public.booking_status OR v_provider IS DISTINCT FROM 'livekit' THEN
    RAISE EXCEPTION 'probe_begin_failed';
  END IF;

  SELECT status INTO v_status FROM public.bookings WHERE id = v_booking;
  IF v_status IS DISTINCT FROM 'rescheduled'::public.booking_status THEN
    RAISE EXCEPTION 'probe_old_booking_changed';
  END IF;

  RAISE EXCEPTION 'probe_passed';
END;
$probe$;
