-- Candidate-owned job targets for job-based interviewer discovery.
-- Stores reviewed job fields only. Does not store raw HTML or secrets.

CREATE TABLE public.candidate_job_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  source_url text,
  source_type text NOT NULL DEFAULT 'url',
  job_id text,
  company_name text,
  job_title text,
  description text,
  skills text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_job_targets_source_type_chk CHECK (source_type IN ('url', 'manual')),
  CONSTRAINT candidate_job_targets_status_chk CHECK (status IN ('draft', 'analyzed', 'ready')),
  CONSTRAINT candidate_job_targets_source_url_chk CHECK (
    source_url IS NULL OR char_length(source_url) <= 2000
  ),
  CONSTRAINT candidate_job_targets_description_chk CHECK (
    description IS NULL OR char_length(description) <= 20000
  )
);

CREATE INDEX candidate_job_targets_candidate_idx
  ON public.candidate_job_targets (candidate_profile_id, updated_at DESC);

CREATE TRIGGER candidate_job_targets_set_updated_at
  BEFORE UPDATE ON public.candidate_job_targets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.candidate_job_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_job_targets_crud ON public.candidate_job_targets
  FOR ALL TO authenticated
  USING (private.owns_candidate_profile(candidate_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_candidate_profile(candidate_profile_id) OR private.is_admin());

REVOKE ALL ON TABLE public.candidate_job_targets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_job_targets TO authenticated;

-- Job-coverage matching. Includes zero-overlap interviewers.
-- Does not use availability, services, bookings, verification, or the candidate's own skills.
CREATE OR REPLACE FUNCTION public.match_interviewers_for_job(
  p_job_skills text[] DEFAULT ARRAY[]::text[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
#variable_conflict use_column
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 50);
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_like text;
  v_search_key text;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_candidate() THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  IF v_search IS NULL THEN
    v_like := NULL;
    v_search_key := NULL;
  ELSE
    v_like := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_search_key := private.canonical_skill_key(v_search);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_job_skills, ARRAY[]::text[])) AS s(skill)
    WHERE private.canonical_skill_key(s.skill) IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'page', v_page,
      'page_size', v_size,
      'total', 0,
      'results', '[]'::jsonb,
      'reason', 'no_job_skills'
    );
  END IF;

  WITH job_raw AS (
    SELECT
      private.canonical_skill_label(raw.skill) AS skill,
      private.canonical_skill_key(raw.skill) AS skill_norm,
      raw.ord
    FROM unnest(COALESCE(p_job_skills, ARRAY[]::text[])) WITH ORDINALITY AS raw(skill, ord)
    WHERE private.canonical_skill_key(raw.skill) IS NOT NULL
  ),
  job AS (
    SELECT DISTINCT ON (skill_norm)
      skill,
      skill_norm,
      ord
    FROM job_raw
    ORDER BY skill_norm, ord
  ),
  job_count AS (
    SELECT COUNT(*)::integer AS n FROM job
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
          SELECT array_agg(j.skill ORDER BY j.ord)
          FROM job j
          WHERE EXISTS (
            SELECT 1
            FROM interviewer_skill_dedup d
            WHERE d.interviewer_profile_id = e.interviewer_profile_id
              AND d.skill_norm = j.skill_norm
          )
        ),
        ARRAY[]::text[]
      ) AS matched_job_skills,
      COALESCE(
        (
          SELECT array_agg(j.skill ORDER BY j.ord)
          FROM job j
          WHERE NOT EXISTS (
            SELECT 1
            FROM interviewer_skill_dedup d
            WHERE d.interviewer_profile_id = e.interviewer_profile_id
              AND d.skill_norm = j.skill_norm
          )
        ),
        ARRAY[]::text[]
      ) AS missing_job_skills,
      COALESCE(
        (
          SELECT array_agg(d.skill ORDER BY d.skill)
          FROM interviewer_skill_dedup d
          WHERE d.interviewer_profile_id = e.interviewer_profile_id
            AND NOT EXISTS (
              SELECT 1 FROM job j WHERE j.skill_norm = d.skill_norm
            )
        ),
        ARRAY[]::text[]
      ) AS extra_interviewer_skills
    FROM eligible e
  ),
  with_ratio AS (
    SELECT
      s.*,
      (cardinality(s.matched_job_skills)::numeric / (SELECT n FROM job_count)::numeric) AS skill_ratio
    FROM scored s
  ),
  filtered AS (
    SELECT w.*
    FROM with_ratio w
    WHERE v_search IS NULL
      OR w.full_name ILIKE v_like ESCAPE '\'
      OR COALESCE(w.headline, '') ILIKE v_like ESCAPE '\'
      OR COALESCE(w.current_role, '') ILIKE v_like ESCAPE '\'
      OR COALESCE(w.company, '') ILIKE v_like ESCAPE '\'
      OR (
        v_search_key IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM interviewer_skill_dedup d
          WHERE d.interviewer_profile_id = w.interviewer_profile_id
            AND d.skill_norm = v_search_key
        )
      )
  ),
  page_rows AS (
    SELECT
      f.*,
      round(f.skill_ratio * 1000) / 10 AS skill_percent,
      (
        SELECT ROUND(AVG(cr.overall_rating)::numeric, 1)
        FROM public.candidate_reviews cr
        WHERE cr.interviewer_profile_id = f.interviewer_profile_id
          AND cr.moderation_status = 'approved'::public.moderation_status
      ) AS rating_avg,
      (
        SELECT COUNT(*)::integer
        FROM public.candidate_reviews cr
        WHERE cr.interviewer_profile_id = f.interviewer_profile_id
          AND cr.moderation_status = 'approved'::public.moderation_status
      ) AS review_count,
      (
        SELECT COUNT(*)::integer
        FROM public.bookings b
        WHERE b.interviewer_profile_id = f.interviewer_profile_id
          AND b.status = 'completed'::public.booking_status
      ) AS completed_interviews_count
    FROM filtered f
    ORDER BY f.skill_ratio DESC, f.interviewer_profile_id ASC
    OFFSET (v_page - 1) * v_size
    LIMIT v_size
  )
  SELECT jsonb_build_object(
    'page', v_page,
    'page_size', v_size,
    'total', (SELECT COUNT(*)::integer FROM filtered),
    'results', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'interviewer_profile_id', pr.interviewer_profile_id,
            'full_name', pr.full_name,
            'avatar_url', pr.avatar_url,
            'headline', pr.headline,
            'bio', pr.bio,
            'current_role', pr.current_role,
            'company', pr.company,
            'experience_years', pr.experience_years,
            'timezone', pr.timezone,
            'languages', pr.languages,
            'skills', pr.skills,
            'matched_job_skills', pr.matched_job_skills,
            'missing_job_skills', pr.missing_job_skills,
            'extra_interviewer_skills', pr.extra_interviewer_skills,
            'skill_ratio', pr.skill_ratio,
            'skill_percent', pr.skill_percent,
            'rating_avg', pr.rating_avg,
            'review_count', pr.review_count,
            'completed_interviews_count', pr.completed_interviews_count,
            'is_online', pr.is_online,
            'list_price_paise', pr.list_price_paise,
            'currency', pr.currency,
            'is_listed', pr.is_listed
          )
          ORDER BY pr.skill_ratio DESC, pr.interviewer_profile_id ASC
        )
        FROM page_rows pr
      ),
      '[]'::jsonb
    ),
    'reason', NULL
  )
  INTO v_payload;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.match_interviewers_for_job(text[], integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_interviewers_for_job(text[], integer, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_interviewers_for_job(text[], integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_interviewers_for_job(text[], integer, integer, text) TO postgres, service_role;

COMMENT ON FUNCTION public.match_interviewers_for_job(text[], integer, integer, text) IS
  'Candidate-only job-coverage interviewer discovery. Score is matched job skills / distinct job skills. Zero coverage stays eligible.';
