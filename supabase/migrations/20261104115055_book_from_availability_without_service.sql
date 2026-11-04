-- Candidates can see and book open times from interviewer availability
-- even when the interviewer has not published a service yet.

ALTER TABLE public.bookings
  ALTER COLUMN service_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION private.list_bookable_slots(
  p_interviewer_profile_id uuid,
  p_service_id uuid,
  p_from timestamptz DEFAULT now(),
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tz text;
  v_buffer integer;
  v_duration integer;
  v_listed boolean;
  v_active boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_is_owner boolean;
BEGIN
  PERFORM private.expire_stale_holds(p_interviewer_profile_id);

  IF p_service_id IS NOT NULL THEN
    SELECT ip.timezone, ip.booking_buffer_min, ip.is_listed, p.is_active, s.duration_min
    INTO v_tz, v_buffer, v_listed, v_active, v_duration
    FROM public.interviewer_services s
    JOIN public.interviewer_profiles ip ON ip.id = s.interviewer_profile_id
    JOIN public.profiles p ON p.id = ip.profile_id
    WHERE s.id = p_service_id
      AND s.interviewer_profile_id = p_interviewer_profile_id
      AND s.is_active;
  END IF;

  -- No published service: still offer slots from weekly/custom availability.
  IF v_duration IS NULL THEN
    SELECT ip.timezone, ip.booking_buffer_min, ip.is_listed, p.is_active, 45
    INTO v_tz, v_buffer, v_listed, v_active, v_duration
    FROM public.interviewer_profiles ip
    JOIN public.profiles p ON p.id = ip.profile_id
    WHERE ip.id = p_interviewer_profile_id;
  END IF;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  v_is_owner := private.owns_interviewer_profile(p_interviewer_profile_id) OR private.is_admin();
  IF NOT v_is_owner AND NOT v_active THEN
    RETURN;
  END IF;

  v_from := COALESCE(p_from, now());
  v_to := LEAST(
    COALESCE(p_to, v_from + interval '28 days'),
    v_from + interval '28 days'
  );
  IF v_to <= v_from THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH dates AS (
    SELECT d::date AS d
    FROM generate_series(
      (v_from AT TIME ZONE v_tz)::date,
      (v_to AT TIME ZONE v_tz)::date,
      interval '1 day'
    ) AS d
  ),
  windows AS (
    SELECT
      private.wall_tstz(dates.d, a.start_time, v_tz) AS wstart,
      private.wall_tstz(dates.d, a.end_time, v_tz) AS wend
    FROM dates
    JOIN public.interviewer_availability a
      ON a.interviewer_profile_id = p_interviewer_profile_id
     AND a.weekday = EXTRACT(DOW FROM dates.d)::smallint
    UNION ALL
    SELECT
      private.wall_tstz(c.on_date, c.start_time, v_tz),
      private.wall_tstz(c.on_date, c.end_time, v_tz)
    FROM public.interviewer_custom_slots c
    WHERE c.interviewer_profile_id = p_interviewer_profile_id
      AND c.on_date BETWEEN (v_from AT TIME ZONE v_tz)::date AND (v_to AT TIME ZONE v_tz)::date
  ),
  blocked AS (
    SELECT
      CASE
        WHEN b.all_day OR b.start_time IS NULL
          THEN private.wall_tstz(b.on_date, time '00:00', v_tz)
        ELSE private.wall_tstz(b.on_date, b.start_time, v_tz)
      END AS bstart,
      CASE
        WHEN b.all_day OR b.end_time IS NULL
          THEN private.wall_tstz(b.on_date + 1, time '00:00', v_tz)
        ELSE private.wall_tstz(b.on_date, b.end_time, v_tz)
      END AS bend
    FROM public.interviewer_blocked_times b
    WHERE b.interviewer_profile_id = p_interviewer_profile_id
  ),
  occupied AS (
    SELECT
      bk.starts_at,
      bk.ends_at + make_interval(mins => v_buffer) AS occ_end
    FROM public.bookings bk
    WHERE bk.interviewer_profile_id = p_interviewer_profile_id
      AND bk.status IN (
        'pending_payment'::public.booking_status,
        'requested'::public.booking_status,
        'confirmed'::public.booking_status,
        'in_progress'::public.booking_status
      )
  ),
  raw_slots AS (
    SELECT
      gs AS slot_start,
      gs + make_interval(mins => v_duration) AS slot_end
    FROM windows w
    CROSS JOIN LATERAL generate_series(
      w.wstart,
      w.wend - make_interval(mins => v_duration),
      make_interval(mins => v_duration)
    ) AS gs
  )
  SELECT rs.slot_start, rs.slot_end
  FROM raw_slots rs
  WHERE rs.slot_start >= GREATEST(v_from, now())
    AND rs.slot_end <= v_to
    AND NOT EXISTS (
      SELECT 1 FROM blocked b
      WHERE rs.slot_start < b.bend AND b.bstart < rs.slot_end
    )
    AND NOT EXISTS (
      SELECT 1 FROM occupied o
      WHERE rs.slot_start < o.occ_end AND o.starts_at < rs.slot_end
    )
  ORDER BY rs.slot_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_from_availability(
  p_interviewer_profile_id uuid,
  p_starts_at timestamptz,
  p_display_timezone text,
  p_duration_min integer DEFAULT 45
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_candidate uuid;
  v_interviewer public.interviewer_profiles%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_ends timestamptz;
  v_fee integer;
  v_platform integer;
  v_duration integer;
  v_booking public.bookings;
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_candidate := private.current_candidate_profile_id();
  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  IF p_interviewer_profile_id IS NULL THEN
    RAISE EXCEPTION 'interviewer_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_duration := COALESCE(NULLIF(p_duration_min, 0), 45);
  IF v_duration < 15 OR v_duration > 240 THEN
    RAISE EXCEPTION 'invalid_duration' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_interviewer
  FROM public.interviewer_profiles
  WHERE id = p_interviewer_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'interviewer_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_interviewer.profile_id;

  IF NOT v_profile.is_active THEN
    RAISE EXCEPTION 'interviewer_not_listed' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.expire_stale_holds(v_interviewer.id);

  v_ends := p_starts_at + make_interval(mins => v_duration);
  v_fee := COALESCE(v_interviewer.list_price_paise, 0);
  v_platform := private.platform_fee_paise(v_fee);

  SELECT EXISTS (
    SELECT 1
    FROM private.list_bookable_slots(
      v_interviewer.id,
      NULL,
      p_starts_at,
      v_ends
    ) s
    WHERE s.starts_at = p_starts_at
      AND s.ends_at = v_ends
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bookings (
    candidate_profile_id,
    interviewer_profile_id,
    service_id,
    status,
    starts_at,
    ends_at,
    display_timezone,
    interviewer_timezone,
    duration_min,
    session_fee_paise,
    platform_fee_paise,
    total_paise,
    currency,
    mode,
    hold_expires_at
  )
  VALUES (
    v_candidate,
    v_interviewer.id,
    NULL,
    'pending_payment',
    p_starts_at,
    v_ends,
    COALESCE(NULLIF(p_display_timezone, ''), v_profile.timezone),
    v_interviewer.timezone,
    v_duration,
    v_fee,
    v_platform,
    v_fee + v_platform,
    COALESCE(NULLIF(v_interviewer.currency, ''), 'INR'),
    'video',
    now() + interval '10 minutes'
  )
  RETURNING * INTO v_booking;

  INSERT INTO public.payments (
    booking_id,
    candidate_profile_id,
    amount_paise,
    platform_fee_paise,
    currency,
    status,
    provider
  )
  VALUES (
    v_booking.id,
    v_candidate,
    v_booking.total_paise,
    v_booking.platform_fee_paise,
    v_booking.currency,
    'created',
    'stub'
  );

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_from_availability(uuid, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_from_availability(uuid, timestamptz, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_bookable_slots(uuid, uuid, timestamptz, timestamptz) TO authenticated;
