-- Notification delivery outbox.
-- Extends private.notify so booking_* in-app notifications also enqueue
-- provider-neutral email/WhatsApp delivery rows for a future worker/n8n.
-- Does NOT send email, WhatsApp, or call any external provider.

-- -----------------------------------------------------------------------------
-- 1. Outbox table
-- -----------------------------------------------------------------------------

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  provider_message_id text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_channel_chk CHECK (channel IN ('email', 'whatsapp')),
  CONSTRAINT notification_deliveries_status_chk CHECK (
    status IN ('pending', 'processing', 'sent', 'delivered', 'failed')
  ),
  CONSTRAINT notification_deliveries_attempts_chk CHECK (attempts >= 0),
  CONSTRAINT notification_deliveries_notification_channel_uidx UNIQUE (notification_id, channel)
);

CREATE INDEX notification_deliveries_pending_idx
  ON public.notification_deliveries (status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX notification_deliveries_notification_idx
  ON public.notification_deliveries (notification_id, created_at);

CREATE TRIGGER notification_deliveries_set_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Server-only access (no authenticated / anon client access)
-- -----------------------------------------------------------------------------

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notification_deliveries TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 3. Idempotent enqueue helper
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.enqueue_notification_delivery(
  p_notification_id uuid,
  p_channel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_notification_id IS NULL OR p_channel IS NULL THEN
    RETURN;
  END IF;
  IF p_channel NOT IN ('email', 'whatsapp') THEN
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.notification_deliveries (notification_id, channel, status)
    VALUES (p_notification_id, p_channel, 'pending');
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION private.enqueue_notification_delivery(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.enqueue_notification_delivery(uuid, text)
  TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 4. Extend private.notify — keep in-app insert + prefs; enqueue outbox rows
-- -----------------------------------------------------------------------------

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
  v_notification_id uuid;
  v_is_interviewer boolean;
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

  -- Find existing notification (idempotent) or insert a new one.
  IF v_booking_id IS NOT NULL THEN
    SELECT n.id
    INTO v_notification_id
    FROM public.notifications n
    WHERE n.profile_id = p_profile_id
      AND n.kind = p_kind
      AND n.payload->>'booking_id' = v_booking_id;
  END IF;

  IF v_notification_id IS NULL THEN
    BEGIN
      INSERT INTO public.notifications (profile_id, kind, title, body, payload)
      VALUES (p_profile_id, p_kind, p_title, p_body, v_payload)
      RETURNING id INTO v_notification_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT n.id
        INTO v_notification_id
        FROM public.notifications n
        WHERE n.profile_id = p_profile_id
          AND n.kind = p_kind
          AND n.payload->>'booking_id' = v_booking_id;
    END;
  END IF;

  IF v_notification_id IS NULL THEN
    RETURN;
  END IF;

  -- Provider-neutral outbox enqueue (no external sends here).
  -- booking_requested → interviewer email + WhatsApp only (candidate stays in-app).
  -- booking_confirmed / booking_rejected → candidate email only.
  IF p_kind = 'booking_requested' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.interviewer_profiles ip
      WHERE ip.profile_id = p_profile_id
    ) INTO v_is_interviewer;

    IF v_is_interviewer THEN
      PERFORM private.enqueue_notification_delivery(v_notification_id, 'email');
      PERFORM private.enqueue_notification_delivery(v_notification_id, 'whatsapp');
    END IF;
  ELSIF p_kind IN ('booking_confirmed', 'booking_rejected') THEN
    PERFORM private.enqueue_notification_delivery(v_notification_id, 'email');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.notify(uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.notify(uuid, text, text, text, jsonb)
  TO postgres, service_role;
