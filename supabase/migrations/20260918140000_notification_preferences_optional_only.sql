-- Keep transactional booking/session notifications mandatory.
-- booking_updates now only controls optional interview reminders.
-- feedback_updates still controls feedback_ready.

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
    IF p_kind = 'interview_reminder' AND NOT v_prefs.booking_updates THEN
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
