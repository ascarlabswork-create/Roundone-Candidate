-- Optional saved-job context for an existing AI practice session.
-- The snapshot is built on the server from the caller's own candidate_job_targets row.

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS job_target_id uuid REFERENCES public.candidate_job_targets (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_context jsonb;

ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS practice_sessions_job_context_chk;

ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_job_context_chk CHECK (
    job_context IS NULL
    OR (
      jsonb_typeof(job_context) = 'object'
      AND (job_context - ARRAY['company_name', 'job_title', 'description', 'skills']::text[]) = '{}'::jsonb
      AND (
        NOT (job_context ? 'skills')
        OR jsonb_typeof(job_context->'skills') = 'array'
      )
      AND (
        NOT (job_context ? 'description')
        OR (
          jsonb_typeof(job_context->'description') = 'string'
          AND char_length(job_context->>'description') <= 8000
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS practice_sessions_job_target_idx
  ON public.practice_sessions (job_target_id)
  WHERE job_target_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.start_practice_session(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate uuid;
  v_session uuid;
  v_role text;
  v_type text;
  v_difficulty text;
  v_topics text[];
  v_count integer;
  v_job_target_text text;
  v_job_target uuid;
  v_job_context jsonb;
  v_owned boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_candidate := private.current_candidate_profile_id();
  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_role := btrim(COALESCE(p_payload->>'target_role', ''));
  v_type := btrim(COALESCE(p_payload->>'interview_type', ''));
  v_difficulty := lower(btrim(COALESCE(p_payload->>'difficulty', '')));
  v_count := COALESCE((p_payload->>'question_count')::integer, 0);

  IF v_role = '' OR char_length(v_role) > 80 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  IF v_type = '' OR char_length(v_type) > 60 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  IF v_difficulty NOT IN ('beginner', 'intermediate', 'advanced') THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  IF v_count < 1 OR v_count > 8 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(btrim(x)), '{}')
  INTO v_topics
  FROM (
    SELECT x
    FROM unnest(
      CASE
        WHEN jsonb_typeof(p_payload->'topics') = 'array' THEN ARRAY(
          SELECT btrim(value #>> '{}')
          FROM jsonb_array_elements(p_payload->'topics')
          LIMIT 6
        )
        ELSE ARRAY[]::text[]
      END
    ) AS x
    WHERE x <> ''
  ) t;

  v_job_target_text := NULLIF(btrim(COALESCE(p_payload->>'job_target_id', '')), '');
  v_job_target := NULL;
  v_job_context := NULL;

  IF v_job_target_text IS NOT NULL THEN
    IF v_job_target_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END IF;
    v_job_target := v_job_target_text::uuid;

    SELECT EXISTS (
      SELECT 1
      FROM public.candidate_job_targets t
      WHERE t.id = v_job_target
        AND t.candidate_profile_id = v_candidate
    )
    INTO v_owned;

    IF NOT v_owned THEN
      RAISE EXCEPTION 'job_target_forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_strip_nulls(jsonb_build_object(
      'company_name', NULLIF(left(btrim(COALESCE(t.company_name, '')), 120), ''),
      'job_title', NULLIF(left(btrim(COALESCE(t.job_title, '')), 160), ''),
      'description', NULLIF(
        left(regexp_replace(btrim(COALESCE(t.description, '')), '<[^>]*>', '', 'g'), 8000),
        ''
      ),
      'skills', COALESCE((
        SELECT jsonb_agg(skill)
        FROM (
          SELECT left(regexp_replace(btrim(s), '<[^>]*>', '', 'g'), 40) AS skill
          FROM unnest(COALESCE(t.skills, '{}'::text[])) AS s
          WHERE btrim(regexp_replace(btrim(s), '<[^>]*>', '', 'g')) <> ''
          LIMIT 12
        ) cleaned
      ), '[]'::jsonb)
    ))
    INTO v_job_context
    FROM public.candidate_job_targets t
    WHERE t.id = v_job_target
      AND t.candidate_profile_id = v_candidate;
  END IF;

  INSERT INTO public.practice_sessions (
    candidate_profile_id,
    target_role,
    interview_type,
    difficulty,
    topics,
    question_count,
    questions_answered,
    average_score,
    status,
    started_at,
    current_index,
    job_target_id,
    job_context
  )
  VALUES (
    v_candidate,
    v_role,
    v_type,
    v_difficulty,
    COALESCE(v_topics, '{}'),
    v_count,
    0,
    NULL,
    'started',
    now(),
    0,
    v_job_target,
    v_job_context
  )
  RETURNING id INTO v_session;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.start_practice_session(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_practice_session(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_practice_session(jsonb) TO postgres, service_role;
