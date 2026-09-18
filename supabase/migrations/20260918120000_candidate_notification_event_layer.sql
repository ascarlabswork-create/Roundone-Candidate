-- Candidate notification event layer.
-- Uses existing public.notifications / public.notification_preferences.
-- Does not add tables, email/SMS/push, or a completion RPC.

CREATE UNIQUE INDEX IF NOT EXISTS notifications_profile_kind_booking_uidx
  ON public.notifications (profile_id, kind, ((payload->>'booking_id')))
  WHERE COALESCE(payload->>'booking_id', '') <> '';

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
DECLARE
  v_prefs public.notification_preferences%ROWTYPE;
  v_booking_id text;
  v_payload jsonb;
BEGIN
  IF p_profile_id IS NULL OR COALESCE(p_kind, '') = '' THEN
    RETURN;
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb);
  v_booking_id := NULLIF(v_payload->>'booking_id', '');

  SELECT *
  INTO v_prefs
  FROM public.notification_preferences
  WHERE profile_id = p_profile_id;

  IF FOUND THEN
    IF p_kind IN (
      'booking_requested',
      'booking_confirmed',
      'booking_rejected',
      'booking_cancelled',
      'booking_rescheduled',
      'booking_expired',
      'interview_completed',
      'interview_reminder'
    ) AND NOT v_prefs.booking_updates THEN
      RETURN;
    END IF;

    IF p_kind = 'feedback_ready' AND NOT v_prefs.feedback_updates THEN
      RETURN;
    END IF;
  END IF;

  IF v_booking_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.profile_id = p_profile_id
        AND n.kind = p_kind
        AND n.payload->>'booking_id' = v_booking_id
    ) THEN
      RETURN;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.notifications (profile_id, kind, title, body, payload)
    VALUES (p_profile_id, p_kind, p_title, p_body, v_payload);
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
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
      v_candidate_profile,
      'booking_requested',
      'Booking request submitted',
      'Your booking request was sent. The interviewer will confirm or decline it.',
      jsonb_build_object('booking_id', NEW.id)
    );
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
  ELSIF NEW.status = 'completed'::public.booking_status THEN
    PERFORM private.notify(
      v_candidate_profile,
      'interview_completed',
      'Interview completed',
      'Your interview has been completed.',
      jsonb_build_object('booking_id', NEW.id)
    );
  END IF;

  RETURN NEW;
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
    'Your interview feedback is available.',
    jsonb_build_object('booking_id', v_booking.id)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_upcoming_interviews()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  n integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT b.id AS booking_id, cp.profile_id AS candidate_profile
    FROM public.bookings b
    JOIN public.candidate_profiles cp ON cp.id = b.candidate_profile_id
    WHERE b.status = 'confirmed'::public.booking_status
      AND b.starts_at > now()
      AND b.starts_at <= now() + interval '1 hour'
  LOOP
    PERFORM private.notify(
      r.candidate_profile,
      'interview_reminder',
      'Upcoming interview reminder',
      'You have an interview starting soon.',
      jsonb_build_object('booking_id', r.booking_id)
    );
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF private.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_protect_update ON public.notifications;
CREATE TRIGGER notifications_protect_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_notification_update();

REVOKE ALL ON FUNCTION private.notify(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_upcoming_interviews() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.protect_notification_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.tg_booking_status() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.notify(uuid, text, text, text, jsonb) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.notify_upcoming_interviews() TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-upcoming-interviews') THEN
    PERFORM cron.unschedule('notify-upcoming-interviews');
  END IF;
END
$$;

SELECT cron.schedule(
  'notify-upcoming-interviews',
  '* * * * *',
  $cron$SELECT private.notify_upcoming_interviews()$cron$
);
