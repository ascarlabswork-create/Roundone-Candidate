-- Checkout no longer adds a platform fee. Session price is the amount due.
CREATE OR REPLACE FUNCTION private.platform_fee_paise(p_session_fee_paise integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT 0 * COALESCE(p_session_fee_paise, 0);
$$;

-- Open holds created before this change still stored the ₹49 minimum.
UPDATE public.bookings
SET platform_fee_paise = 0,
    total_paise = session_fee_paise
WHERE status = 'pending_payment'
  AND platform_fee_paise <> 0;

UPDATE public.payments AS payment
SET platform_fee_paise = 0,
    amount_paise = booking.total_paise
FROM public.bookings AS booking
WHERE payment.booking_id = booking.id
  AND booking.status = 'pending_payment'
  AND payment.platform_fee_paise <> 0;
