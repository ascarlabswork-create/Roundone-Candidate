-- Rolls back. A successful run raises probe_passed and leaves no rows behind.

DO $probe$
DECLARE
  v_instance uuid;
  v_candidate uuid := gen_random_uuid();
  v_interviewer uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_candidate_profile uuid;
  v_interviewer_profile uuid;
  v_service uuid;
  v_booking uuid;
  v_session uuid;
  v_other_booking uuid;
  v_other_session uuid;
  v_ends interval;
  v_message uuid;
  v_count integer;
  v_role text;
  v_access jsonb;
  v_def text;
BEGIN
  v_def := pg_get_functiondef('private.interview_call_access(uuid,uuid)'::regprocedure);
  IF position('starts_at - interval ''15 minutes''' IN v_def) = 0
     OR position('starts_at + interval ''15 minutes''' IN v_def) = 0
     OR position('ends_at + interval ''30 minutes''' IN v_def) <> 0 THEN
    RAISE EXCEPTION 'probe_timing_changed';
  END IF;

  IF NOT (
    SELECT bool_and(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('interview_messages', 'interview_notes', 'interview_recordings', 'interview_app_feedback')
  ) THEN
    RAISE EXCEPTION 'probe_rls_disabled';
  END IF;

  IF has_table_privilege('anon', 'public.interview_messages', 'SELECT')
     OR has_table_privilege('anon', 'public.interview_notes', 'SELECT')
     OR has_table_privilege('anon', 'public.interview_recordings', 'SELECT')
     OR has_table_privilege('anon', 'public.interview_app_feedback', 'SELECT')
     OR has_table_privilege('authenticated', 'public.interview_recordings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.interview_messages', 'UPDATE') THEN
    RAISE EXCEPTION 'probe_privileges';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename IN ('interview_messages', 'interview_recordings')
    HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION 'probe_realtime';
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
    (v_instance, v_candidate, 'authenticated', 'authenticated',
      'probe-room-c-' || v_candidate::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_instance, v_interviewer, 'authenticated', 'authenticated',
      'probe-room-i-' || v_interviewer::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"interviewer"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_instance, v_other, 'authenticated', 'authenticated',
      'probe-room-o-' || v_other::text || '@example.invalid', '', now(),
      '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{}'::jsonb, now(), now());

  SELECT id INTO v_candidate_profile FROM public.candidate_profiles WHERE profile_id = v_candidate;
  SELECT id INTO v_interviewer_profile FROM public.interviewer_profiles WHERE profile_id = v_interviewer;
  IF v_candidate_profile IS NULL OR v_interviewer_profile IS NULL THEN
    RAISE EXCEPTION 'probe_setup_failed';
  END IF;

  INSERT INTO public.interviewer_services (
    interviewer_profile_id, name, interview_type, duration_min, price_paise
  )
  VALUES (v_interviewer_profile, 'Probe room', 'Technical', 30, 100000)
  RETURNING id INTO v_service;

  INSERT INTO public.bookings (
    candidate_profile_id, interviewer_profile_id, service_id, status,
    starts_at, ends_at, display_timezone, interviewer_timezone,
    duration_min, session_fee_paise, platform_fee_paise, total_paise
  )
  VALUES (
    v_candidate_profile, v_interviewer_profile, v_service, 'confirmed',
    now() - interval '1 minute', now() + interval '29 minutes',
    'Asia/Kolkata', 'Asia/Kolkata', 30, 100000, 0, 100000
  )
  RETURNING id INTO v_booking;

  SELECT id INTO v_session FROM public.interview_sessions WHERE booking_id = v_booking;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'probe_session_missing';
  END IF;

  INSERT INTO public.bookings (
    candidate_profile_id, interviewer_profile_id, service_id, status,
    starts_at, ends_at, display_timezone, interviewer_timezone,
    duration_min, session_fee_paise, platform_fee_paise, total_paise
  )
  VALUES (
    (SELECT id FROM public.candidate_profiles WHERE profile_id = v_other),
    v_interviewer_profile, v_service, 'confirmed',
    now() - interval '1 minute', now() + interval '29 minutes',
    'Asia/Kolkata', 'Asia/Kolkata', 30, 100000, 0, 100000
  )
  RETURNING id INTO v_other_booking;
  SELECT id INTO v_other_session FROM public.interview_sessions WHERE booking_id = v_other_booking;

  v_ends := (SELECT ends_at - starts_at FROM public.bookings WHERE id = v_booking);

  PERFORM set_config('request.jwt.claim.sub', v_candidate::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_candidate, 'role', 'authenticated')::text, true);
  IF private.interview_participant_role(v_session) IS DISTINCT FROM 'candidate' THEN
    RAISE EXCEPTION 'probe_candidate_role';
  END IF;
  v_access := public.assert_interview_recording_access(v_session);
  IF v_access->>'room_name' IS DISTINCT FROM 'roundone-interview-' || v_session::text
     OR (SELECT ends_at - starts_at FROM public.bookings WHERE id = v_booking) IS DISTINCT FROM v_ends THEN
    RAISE EXCEPTION 'probe_recording_access_changed_time';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_interviewer::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_interviewer, 'role', 'authenticated')::text, true);
  IF private.interview_participant_role(v_session) IS DISTINCT FROM 'interviewer' THEN
    RAISE EXCEPTION 'probe_interviewer_role';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  IF private.interview_participant_role(v_session) IS NOT NULL THEN
    RAISE EXCEPTION 'probe_stranger_role';
  END IF;
  BEGIN
    PERFORM public.assert_interview_recording_access(v_session);
    RAISE EXCEPTION 'probe_stranger_recording_allowed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%not_authorized%' THEN
        RAISE;
      END IF;
  END;

  EXECUTE 'SET LOCAL ROLE authenticated';

  PERFORM set_config('request.jwt.claim.sub', v_candidate::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_candidate, 'role', 'authenticated')::text, true);
  INSERT INTO public.interview_messages (interview_session_id, sender_user_id, message)
  VALUES (v_session, v_candidate, 'hello from candidate')
  RETURNING id INTO v_message;

  BEGIN
    INSERT INTO public.interview_messages (interview_session_id, sender_user_id, message)
    VALUES (v_session, v_interviewer, 'impersonated');
    RAISE EXCEPTION 'probe_impersonation_allowed';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%permission denied%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.interview_notes (interview_session_id, user_id, notes)
  VALUES (v_session, v_candidate, 'candidate private note');
  INSERT INTO public.interview_app_feedback (interview_session_id, user_id, participant_role, rating, feedback, suggestions)
  VALUES (v_session, v_candidate, 'candidate', 5, 'smooth', 'captions');

  PERFORM set_config('request.jwt.claim.sub', v_interviewer::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_interviewer, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.interview_messages WHERE interview_session_id = v_session;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'probe_interviewer_missed_chat';
  END IF;
  INSERT INTO public.interview_messages (interview_session_id, sender_user_id, message)
  VALUES (v_session, v_interviewer, 'hello from interviewer');
  SELECT count(*) INTO v_count FROM public.interview_notes WHERE interview_session_id = v_session;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'probe_interviewer_read_candidate_notes';
  END IF;
  SELECT count(*) INTO v_count FROM public.interview_app_feedback WHERE interview_session_id = v_session;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'probe_interviewer_read_candidate_feedback';
  END IF;
  INSERT INTO public.interview_notes (interview_session_id, user_id, notes)
  VALUES (v_session, v_interviewer, 'interviewer private note');

  PERFORM set_config('request.jwt.claim.sub', v_candidate::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_candidate, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.interview_messages WHERE interview_session_id = v_session;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'probe_candidate_missed_reply';
  END IF;
  SELECT count(*) INTO v_count FROM public.interview_notes WHERE notes = 'interviewer private note';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'probe_candidate_read_interviewer_notes';
  END IF;
  SELECT notes INTO v_role FROM public.interview_notes WHERE interview_session_id = v_session;
  IF v_role IS DISTINCT FROM 'candidate private note' THEN
    RAISE EXCEPTION 'probe_candidate_lost_notes';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.interview_messages WHERE interview_session_id = v_session;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'probe_chat_leaked';
  END IF;
  BEGIN
    INSERT INTO public.interview_messages (interview_session_id, sender_user_id, message)
    VALUES (v_session, v_other, 'outsider');
    RAISE EXCEPTION 'probe_outsider_sent';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%permission denied%' AND SQLERRM NOT LIKE '%probe_outsider_sent%' THEN
        RAISE;
      END IF;
      IF SQLERRM LIKE '%probe_outsider_sent%' THEN
        RAISE;
      END IF;
  END;
  BEGIN
    INSERT INTO public.interview_recordings (interview_session_id, started_by, status)
    VALUES (v_session, v_other, 'recording');
    RAISE EXCEPTION 'probe_client_recording_insert';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%probe_client_recording_insert%' THEN
        RAISE;
      END IF;
  END;

  EXECUTE 'RESET ROLE';
  IF (SELECT ends_at - starts_at FROM public.bookings WHERE id = v_booking) IS DISTINCT FROM v_ends THEN
    RAISE EXCEPTION 'probe_end_moved';
  END IF;

  RAISE EXCEPTION 'probe_passed';
END;
$probe$;
