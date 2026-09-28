-- Fix claim_notification_deliveries: always terminal-fail missing recipients
-- for the claimed batch (previous CTE short-circuit left rows stuck in processing).

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
  UPDATE public.notification_deliveries d
  SET
    status = 'pending',
    next_attempt_at = NULL,
    updated_at = now()
  WHERE d.status = 'processing'
    AND d.updated_at < now() - v_stale;

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
