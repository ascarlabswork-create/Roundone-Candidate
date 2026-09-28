-- Notification delivery claim + recipient resolution contract.
-- Provider-neutral. Does NOT send email/WhatsApp or call any external API.
-- Intended for a future trusted worker (e.g. n8n via service_role).

-- -----------------------------------------------------------------------------
-- 1. Claim eligibility index (stale processing recovery)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS notification_deliveries_processing_updated_idx
  ON public.notification_deliveries (updated_at)
  WHERE status = 'processing';

-- -----------------------------------------------------------------------------
-- 2. Deep-link helper (relative paths; n8n prepends public base URL)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.notification_deep_link_path(
  p_kind text,
  p_booking_id uuid,
  p_is_interviewer boolean
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN p_is_interviewer AND p_kind = 'booking_requested' AND p_booking_id IS NOT NULL
      THEN '/interviewer/bookings/' || p_booking_id::text
    WHEN p_kind IN ('booking_confirmed', 'booking_rescheduled', 'interview_reminder')
         AND p_booking_id IS NOT NULL
      THEN '/candidate/interview/' || p_booking_id::text
    WHEN p_kind IN (
      'booking_requested',
      'booking_rejected',
      'booking_cancelled',
      'booking_expired',
      'interview_completed',
      'feedback_ready'
    )
      THEN '/candidate/interviews'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION private.notification_deep_link_path(text, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.notification_deep_link_path(text, uuid, boolean)
  TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 3. Recipient resolution (server-only; never exposed to clients)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.resolve_notification_recipient(
  p_profile_id uuid,
  p_channel text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_recipient text;
BEGIN
  IF p_profile_id IS NULL OR p_channel IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_channel = 'email' THEN
    SELECT NULLIF(btrim(u.email), '')
    INTO v_recipient
    FROM auth.users u
    WHERE u.id = p_profile_id;
    RETURN v_recipient;
  END IF;

  IF p_channel = 'whatsapp' THEN
    SELECT NULLIF(btrim(ip.whatsapp_phone), '')
    INTO v_recipient
    FROM public.interviewer_profiles ip
    WHERE ip.profile_id = p_profile_id;
    RETURN v_recipient;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_notification_recipient(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.resolve_notification_recipient(uuid, text)
  TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 4. Atomic claim + resolve
--    Stale-processing timeout default: 15 minutes (updated_at while status=processing).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.claim_notification_deliveries(
  p_limit integer DEFAULT 10,
  p_stale_after interval DEFAULT interval '15 minutes'
)
RETURNS TABLE (
  delivery_id uuid,
  notification_id uuid,
  channel text,
  status text,
  attempts integer,
  notification_kind text,
  notification_title text,
  notification_body text,
  booking_id uuid,
  recipient text,
  deep_link_path text,
  booking_starts_at timestamptz,
  booking_ends_at timestamptz,
  booking_display_timezone text,
  booking_duration_min integer,
  booking_mode text,
  booking_status text,
  service_name text,
  interview_type text,
  counterparty_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
  v_stale interval := COALESCE(p_stale_after, interval '15 minutes');
  v_claimed_ids uuid[];
BEGIN
  -- Recover crashed workers: processing rows older than v_stale → pending again.
  UPDATE public.notification_deliveries d
  SET
    status = 'pending',
    next_attempt_at = NULL,
    updated_at = now()
  WHERE d.status = 'processing'
    AND d.updated_at < now() - v_stale;

  -- Atomically claim a batch (SKIP LOCKED = concurrent workers cannot double-claim).
  WITH claimed AS (
    SELECT d.id
    FROM public.notification_deliveries d
    WHERE d.status = 'pending'
      AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= now())
    ORDER BY d.created_at ASC
    LIMIT v_limit
    FOR UPDATE OF d SKIP LOCKED
  ),
  locked AS (
    UPDATE public.notification_deliveries d
    SET
      status = 'processing',
      attempts = d.attempts + 1,
      updated_at = now()
    FROM claimed c
    WHERE d.id = c.id
    RETURNING d.id
  )
  SELECT coalesce(array_agg(l.id), ARRAY[]::uuid[])
  INTO v_claimed_ids
  FROM locked l;

  IF array_length(v_claimed_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Terminal-fail claimed rows with no resolvable recipient (always runs).
  UPDATE public.notification_deliveries d
  SET
    status = 'failed',
    last_error = CASE
      WHEN d.channel = 'whatsapp' THEN 'No WhatsApp recipient configured'
      WHEN d.channel = 'email' THEN 'No email recipient configured'
      ELSE 'No recipient configured'
    END,
    updated_at = now()
  FROM public.notifications n
  WHERE d.notification_id = n.id
    AND d.id = ANY (v_claimed_ids)
    AND d.status = 'processing'
    AND private.resolve_notification_recipient(n.profile_id, d.channel) IS NULL;

  RETURN QUERY
  SELECT
    d.id AS delivery_id,
    d.notification_id,
    d.channel,
    d.status,
    d.attempts,
    n.kind AS notification_kind,
    n.title AS notification_title,
    n.body AS notification_body,
    CASE
      WHEN (n.payload->>'booking_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (n.payload->>'booking_id')::uuid
      ELSE NULL
    END AS booking_id,
    private.resolve_notification_recipient(n.profile_id, d.channel) AS recipient,
    private.notification_deep_link_path(
      n.kind,
      CASE
        WHEN (n.payload->>'booking_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (n.payload->>'booking_id')::uuid
        ELSE NULL
      END,
      EXISTS (SELECT 1 FROM public.interviewer_profiles ip WHERE ip.profile_id = n.profile_id)
    ) AS deep_link_path,
    b.starts_at AS booking_starts_at,
    b.ends_at AS booking_ends_at,
    b.display_timezone AS booking_display_timezone,
    b.duration_min AS booking_duration_min,
    b.mode AS booking_mode,
    b.status::text AS booking_status,
    s.name AS service_name,
    s.interview_type AS interview_type,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.interviewer_profiles ip WHERE ip.profile_id = n.profile_id)
        THEN cand_p.full_name
      ELSE int_p.full_name
    END AS counterparty_display_name
  FROM public.notification_deliveries d
  JOIN public.notifications n ON n.id = d.notification_id
  LEFT JOIN public.bookings b
    ON b.id = CASE
      WHEN (n.payload->>'booking_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (n.payload->>'booking_id')::uuid
      ELSE NULL
    END
  LEFT JOIN public.interviewer_services s ON s.id = b.service_id
  LEFT JOIN public.candidate_profiles cp ON cp.id = b.candidate_profile_id
  LEFT JOIN public.profiles cand_p ON cand_p.id = cp.profile_id
  LEFT JOIN public.interviewer_profiles ip ON ip.id = b.interviewer_profile_id
  LEFT JOIN public.profiles int_p ON int_p.id = ip.profile_id
  WHERE d.id = ANY (v_claimed_ids)
    AND d.status = 'processing'
  ORDER BY d.id;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_notification_deliveries(integer, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.claim_notification_deliveries(integer, interval)
  TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 5. Future worker state-transition helpers (no provider logic)
-- -----------------------------------------------------------------------------

-- Terminal / success: processing → sent
CREATE OR REPLACE FUNCTION private.mark_notification_delivery_sent(
  p_delivery_id uuid,
  p_provider_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.notification_deliveries
  SET
    status = 'sent',
    provider_message_id = COALESCE(NULLIF(btrim(p_provider_message_id), ''), provider_message_id),
    sent_at = COALESCE(sent_at, now()),
    last_error = NULL,
    next_attempt_at = NULL,
    updated_at = now()
  WHERE id = p_delivery_id
    AND status = 'processing';
END;
$$;

-- Optional provider callback: sent → delivered
CREATE OR REPLACE FUNCTION private.mark_notification_delivery_delivered(
  p_delivery_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.notification_deliveries
  SET
    status = 'delivered',
    delivered_at = COALESCE(delivered_at, now()),
    updated_at = now()
  WHERE id = p_delivery_id
    AND status IN ('sent', 'processing');
END;
$$;

-- Failure: processing → failed (terminal) OR pending (retryable, capped)
-- Retryable: returns to pending with next_attempt_at when attempts < 5.
-- Terminal: missing recipient, permanent provider rejection, or attempts exhausted.
CREATE OR REPLACE FUNCTION private.mark_notification_delivery_failed(
  p_delivery_id uuid,
  p_error text,
  p_retryable boolean DEFAULT false,
  p_retry_after interval DEFAULT interval '5 minutes'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_attempts integer;
BEGIN
  SELECT attempts INTO v_attempts
  FROM public.notification_deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_retryable AND COALESCE(v_attempts, 0) < 5 THEN
    UPDATE public.notification_deliveries
    SET
      status = 'pending',
      last_error = NULLIF(left(COALESCE(p_error, ''), 500), ''),
      next_attempt_at = now() + COALESCE(p_retry_after, interval '5 minutes'),
      updated_at = now()
    WHERE id = p_delivery_id
      AND status = 'processing';
  ELSE
    UPDATE public.notification_deliveries
    SET
      status = 'failed',
      last_error = NULLIF(left(COALESCE(p_error, 'Delivery failed'), 500), ''),
      next_attempt_at = NULL,
      updated_at = now()
    WHERE id = p_delivery_id
      AND status = 'processing';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.mark_notification_delivery_sent(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mark_notification_delivery_delivered(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mark_notification_delivery_failed(uuid, text, boolean, interval)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.mark_notification_delivery_sent(uuid, text)
  TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.mark_notification_delivery_delivered(uuid)
  TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.mark_notification_delivery_failed(uuid, text, boolean, interval)
  TO postgres, service_role;
