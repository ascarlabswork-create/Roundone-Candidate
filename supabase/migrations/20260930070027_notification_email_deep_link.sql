-- Interviewer booking-request emails deep-link to the pending bookings tab.
-- Does not change notify, booking RPCs, or recipient resolution.

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
      THEN '/interviewer/bookings?tab=pending&booking=' || p_booking_id::text
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
