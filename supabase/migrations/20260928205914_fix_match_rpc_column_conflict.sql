-- RETURNS TABLE output names collided with query columns inside plpgsql.
CREATE OR REPLACE FUNCTION public.match_interviewers_by_skills(p_candidate_skills text[])
RETURNS TABLE (
  interviewer_profile_id uuid,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  "current_role" text,
  company text,
  experience_years integer,
  timezone text,
  languages text[],
  skills text[],
  matched_skills text[],
  missing_candidate_skills text[],
  extra_interviewer_skills text[],
  skill_ratio numeric,
  skill_percent numeric,
  rating_avg numeric,
  review_count integer,
  completed_interviews_count integer,
  is_online boolean,
  list_price_paise integer,
  currency text,
  is_listed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_candidate() THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_candidate_skills, ARRAY[]::text[])) AS s(skill)
    WHERE private.canonical_skill_key(s.skill) IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH cand_raw AS (
    SELECT
      private.canonical_skill_label(raw.skill) AS skill,
      private.canonical_skill_key(raw.skill) AS skill_norm,
      raw.ord
    FROM unnest(COALESCE(p_candidate_skills, ARRAY[]::text[])) WITH ORDINALITY AS raw(skill, ord)
    WHERE private.canonical_skill_key(raw.skill) IS NOT NULL
  ),
  cand AS (
    SELECT DISTINCT ON (skill_norm)
      skill,
      skill_norm,
      ord
    FROM cand_raw
    ORDER BY skill_norm, ord
  ),
  cand_count AS (
    SELECT COUNT(*)::integer AS n FROM cand
  ),
  eligible AS (
    SELECT
      ip.id AS interviewer_profile_id,
      p.full_name,
      p.avatar_url,
      ip.headline,
      ip.bio,
      ip."current_role" AS current_role,
      ip.company,
      ip.experience_years,
      ip.timezone,
      ip.languages,
      ip.is_online,
      ip.list_price_paise,
      ip.currency,
      ip.is_listed
    FROM public.interviewer_profiles ip
    JOIN public.profiles p ON p.id = ip.profile_id
    WHERE p.is_active
      AND EXISTS (
        SELECT 1
        FROM public.interviewer_skills sk
        WHERE sk.interviewer_profile_id = ip.id
      )
  ),
  interviewer_skill_rows AS (
    SELECT
      sk.interviewer_profile_id,
      private.canonical_skill_label(sk.skill) AS skill,
      private.canonical_skill_key(sk.skill) AS skill_norm,
      ROW_NUMBER() OVER (
        PARTITION BY sk.interviewer_profile_id, private.canonical_skill_key(sk.skill)
        ORDER BY sk.skill
      ) AS rn
    FROM public.interviewer_skills sk
    INNER JOIN eligible e ON e.interviewer_profile_id = sk.interviewer_profile_id
    WHERE private.canonical_skill_key(sk.skill) IS NOT NULL
  ),
  interviewer_skill_dedup AS (
    SELECT interviewer_profile_id, skill, skill_norm
    FROM interviewer_skill_rows
    WHERE rn = 1
  ),
  scored AS (
    SELECT
      e.interviewer_profile_id,
      e.full_name,
      e.avatar_url,
      e.headline,
      e.bio,
      e.current_role,
      e.company,
      e.experience_years,
      e.timezone,
      e.languages,
      e.is_online,
      e.list_price_paise,
      e.currency,
      e.is_listed,
      COALESCE(
        (
          SELECT array_agg(d.skill ORDER BY d.skill)
          FROM interviewer_skill_dedup d
          WHERE d.interviewer_profile_id = e.interviewer_profile_id
        ),
        ARRAY[]::text[]
      ) AS skills,
      COALESCE(
        (
          SELECT array_agg(c.skill ORDER BY c.ord)
          FROM cand c
          WHERE EXISTS (
            SELECT 1
            FROM interviewer_skill_dedup d
            WHERE d.interviewer_profile_id = e.interviewer_profile_id
              AND d.skill_norm = c.skill_norm
          )
        ),
        ARRAY[]::text[]
      ) AS matched_skills,
      COALESCE(
        (
          SELECT array_agg(c.skill ORDER BY c.ord)
          FROM cand c
          WHERE NOT EXISTS (
            SELECT 1
            FROM interviewer_skill_dedup d
            WHERE d.interviewer_profile_id = e.interviewer_profile_id
              AND d.skill_norm = c.skill_norm
          )
        ),
        ARRAY[]::text[]
      ) AS missing_candidate_skills,
      COALESCE(
        (
          SELECT array_agg(d.skill ORDER BY d.skill)
          FROM interviewer_skill_dedup d
          WHERE d.interviewer_profile_id = e.interviewer_profile_id
            AND NOT EXISTS (
              SELECT 1
              FROM cand c
              WHERE c.skill_norm = d.skill_norm
            )
        ),
        ARRAY[]::text[]
      ) AS extra_interviewer_skills
    FROM eligible e
  ),
  with_ratio AS (
    SELECT
      s.*,
      (cardinality(s.matched_skills)::numeric / (SELECT n FROM cand_count)::numeric) AS skill_ratio
    FROM scored s
    WHERE cardinality(s.matched_skills) > 0
  )
  SELECT
    w.interviewer_profile_id,
    w.full_name,
    w.avatar_url,
    w.headline,
    w.bio,
    w.current_role,
    w.company,
    w.experience_years,
    w.timezone,
    w.languages,
    w.skills,
    w.matched_skills,
    w.missing_candidate_skills,
    w.extra_interviewer_skills,
    w.skill_ratio,
    round(w.skill_ratio * 1000) / 10 AS skill_percent,
    (
      SELECT ROUND(AVG(cr.overall_rating)::numeric, 1)
      FROM public.candidate_reviews cr
      WHERE cr.interviewer_profile_id = w.interviewer_profile_id
        AND cr.moderation_status = 'approved'::public.moderation_status
    ) AS rating_avg,
    (
      SELECT COUNT(*)::integer
      FROM public.candidate_reviews cr
      WHERE cr.interviewer_profile_id = w.interviewer_profile_id
        AND cr.moderation_status = 'approved'::public.moderation_status
    ) AS review_count,
    (
      SELECT COUNT(*)::integer
      FROM public.bookings b
      WHERE b.interviewer_profile_id = w.interviewer_profile_id
        AND b.status = 'completed'::public.booking_status
    ) AS completed_interviews_count,
    w.is_online,
    w.list_price_paise,
    w.currency,
    w.is_listed
  FROM with_ratio w
  ORDER BY w.skill_ratio DESC, w.interviewer_profile_id ASC
  LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.match_interviewers_by_skills(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_interviewers_by_skills(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_interviewers_by_skills(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_interviewers_by_skills(text[]) TO postgres, service_role;

