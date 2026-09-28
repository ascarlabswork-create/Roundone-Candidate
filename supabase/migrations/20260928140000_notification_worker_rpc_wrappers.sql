-- Thin public RPC wrappers for the notification-worker Edge Function.
-- Delegates to private.* helpers from Step 5. Executable only by service_role.
-- Does not change claim/recipient/notify logic.

CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
  SELECT *
  FROM private.claim_notification_deliveries(p_limit, p_stale_after);
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_delivery_sent(
  p_delivery_id uuid,
  p_provider_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
  SELECT private.mark_notification_delivery_sent(p_delivery_id, p_provider_message_id);
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_delivery_delivered(
  p_delivery_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
  SELECT private.mark_notification_delivery_delivered(p_delivery_id);
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_delivery_failed(
  p_delivery_id uuid,
  p_error text,
  p_retryable boolean DEFAULT false,
  p_retry_after interval DEFAULT interval '5 minutes'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
  SELECT private.mark_notification_delivery_failed(
    p_delivery_id,
    p_error,
    p_retryable,
    p_retry_after
  );
$$;

REVOKE ALL ON FUNCTION public.claim_notification_deliveries(integer, interval)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_delivery_sent(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_delivery_delivered(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_delivery_failed(uuid, text, boolean, interval)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries(integer, interval)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_delivery_sent(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_delivery_delivered(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_delivery_failed(uuid, text, boolean, interval)
  TO service_role;
