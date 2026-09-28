-- Verification-only: exercises private.notify outbox enqueue + idempotency,
-- asserts authenticated has no privileges on notification_deliveries, then
-- deletes the synthetic test notification rows. No lasting schema changes.

DO $$
DECLARE
  v_candidate uuid := 'de2a114c-2006-4487-8f6d-968a2c9b02a9';
  v_interviewer uuid := '51be9c6d-1087-45fd-b319-9d0fe63d89aa';
  v_booking text := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_payload jsonb := jsonb_build_object('booking_id', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  v_cand_req int;
  v_int_req int;
  v_int_email int;
  v_int_wa int;
  v_cand_req_del int;
  v_conf_n int;
  v_conf_d int;
  v_rej_n int;
  v_rej_d int;
  v_dup_n int;
  v_dup_d int;
  v_auth_select boolean;
  v_auth_insert boolean;
  v_auth_update boolean;
  v_auth_delete boolean;
BEGIN
  PERFORM private.notify(v_candidate, 'booking_requested', 'Booking request submitted', 'test body', v_payload);
  PERFORM private.notify(v_interviewer, 'booking_requested', 'New booking request', 'test body', v_payload);
  PERFORM private.notify(v_candidate, 'booking_confirmed', 'Interview confirmed', 'test body', v_payload);
  PERFORM private.notify(v_candidate, 'booking_rejected', 'Booking declined', 'test body', v_payload);

  PERFORM private.notify(v_candidate, 'booking_requested', 'Booking request submitted', 'test body', v_payload);
  PERFORM private.notify(v_interviewer, 'booking_requested', 'New booking request', 'test body', v_payload);
  PERFORM private.notify(v_candidate, 'booking_confirmed', 'Interview confirmed', 'test body', v_payload);
  PERFORM private.notify(v_candidate, 'booking_rejected', 'Booking declined', 'test body', v_payload);

  SELECT count(*) INTO v_cand_req FROM public.notifications WHERE profile_id=v_candidate AND kind='booking_requested' AND payload->>'booking_id'=v_booking;
  SELECT count(*) INTO v_int_req FROM public.notifications WHERE profile_id=v_interviewer AND kind='booking_requested' AND payload->>'booking_id'=v_booking;
  SELECT count(*) INTO v_int_email FROM public.notification_deliveries d JOIN public.notifications n ON n.id=d.notification_id WHERE n.profile_id=v_interviewer AND n.kind='booking_requested' AND n.payload->>'booking_id'=v_booking AND d.channel='email';
  SELECT count(*) INTO v_int_wa FROM public.notification_deliveries d JOIN public.notifications n ON n.id=d.notification_id WHERE n.profile_id=v_interviewer AND n.kind='booking_requested' AND n.payload->>'booking_id'=v_booking AND d.channel='whatsapp';
  SELECT count(*) INTO v_cand_req_del FROM public.notification_deliveries d JOIN public.notifications n ON n.id=d.notification_id WHERE n.profile_id=v_candidate AND n.kind='booking_requested' AND n.payload->>'booking_id'=v_booking;
  SELECT count(*) INTO v_conf_n FROM public.notifications WHERE profile_id=v_candidate AND kind='booking_confirmed' AND payload->>'booking_id'=v_booking;
  SELECT count(*) INTO v_conf_d FROM public.notification_deliveries d JOIN public.notifications n ON n.id=d.notification_id WHERE n.profile_id=v_candidate AND n.kind='booking_confirmed' AND n.payload->>'booking_id'=v_booking AND d.channel='email';
  SELECT count(*) INTO v_rej_n FROM public.notifications WHERE profile_id=v_candidate AND kind='booking_rejected' AND payload->>'booking_id'=v_booking;
  SELECT count(*) INTO v_rej_d FROM public.notification_deliveries d JOIN public.notifications n ON n.id=d.notification_id WHERE n.profile_id=v_candidate AND n.kind='booking_rejected' AND n.payload->>'booking_id'=v_booking AND d.channel='email';
  SELECT count(*) INTO v_dup_n FROM public.notifications WHERE payload->>'booking_id'=v_booking;
  SELECT count(*) INTO v_dup_d FROM public.notification_deliveries d JOIN public.notifications n ON n.id=d.notification_id WHERE n.payload->>'booking_id'=v_booking;

  v_auth_select := has_table_privilege('authenticated', 'public.notification_deliveries', 'SELECT');
  v_auth_insert := has_table_privilege('authenticated', 'public.notification_deliveries', 'INSERT');
  v_auth_update := has_table_privilege('authenticated', 'public.notification_deliveries', 'UPDATE');
  v_auth_delete := has_table_privilege('authenticated', 'public.notification_deliveries', 'DELETE');

  IF v_cand_req <> 1 OR v_int_req <> 1 THEN
    RAISE EXCEPTION 'notification idempotency failed cand=% int=%', v_cand_req, v_int_req;
  END IF;
  IF v_int_email <> 1 OR v_int_wa <> 1 THEN
    RAISE EXCEPTION 'interviewer deliveries failed email=% wa=%', v_int_email, v_int_wa;
  END IF;
  IF v_cand_req_del <> 0 THEN
    RAISE EXCEPTION 'candidate booking_requested must not enqueue deliveries, got %', v_cand_req_del;
  END IF;
  IF v_conf_n <> 1 OR v_conf_d <> 1 OR v_rej_n <> 1 OR v_rej_d <> 1 THEN
    RAISE EXCEPTION 'confirmed/rejected failed n_conf=% d_conf=% n_rej=% d_rej=%', v_conf_n, v_conf_d, v_rej_n, v_rej_d;
  END IF;
  IF v_dup_n <> 4 OR v_dup_d <> 4 THEN
    RAISE EXCEPTION 'duplicate totals unexpected notifications=% deliveries=%', v_dup_n, v_dup_d;
  END IF;
  IF v_auth_select OR v_auth_insert OR v_auth_update OR v_auth_delete THEN
    RAISE EXCEPTION 'authenticated still has privileges on notification_deliveries';
  END IF;

  DELETE FROM public.notifications WHERE payload->>'booking_id' = v_booking;
END $$;
