-- Make interviewer-initiated reschedules clearer for candidates in in-app notifications.
-- Also distinguish "confirmed after reschedule" from a first-time confirmation.

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
    IF NEW.rescheduled_from_booking_id IS NOT NULL THEN
      PERFORM private.notify(
        v_candidate_profile,
        'booking_confirmed',
        'New interview time',
        'Your interviewer rescheduled this interview. This is your new confirmed time — open it from My Interviews.',
        jsonb_build_object(
          'booking_id', NEW.id,
          'rescheduled_from_booking_id', NEW.rescheduled_from_booking_id
        )
      );
    ELSE
      PERFORM private.notify(
        v_candidate_profile,
        'booking_confirmed',
        'Interview confirmed',
        'Your interviewer confirmed the booking.',
        jsonb_build_object('booking_id', NEW.id)
      );
    END IF;
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
      'Interviewer rescheduled',
      'Your interviewer moved this interview to a new time. Open My Interviews to see the updated booking.',
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

COMMENT ON FUNCTION private.tg_booking_status() IS
  'Writes booking_events and candidate/interviewer notifications. Reschedule copy names the interviewer.';
