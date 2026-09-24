-- Extend AI practice sessions for in-progress interviews.
-- Ownership still comes from private.current_candidate_profile_id().

ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS practice_sessions_status_chk;

ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_status_chk
  CHECK (status IN ('started', 'completed', 'failed'));

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS current_index integer NOT NULL DEFAULT 0;

ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS practice_sessions_current_index_chk;

ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_current_index_chk
  CHECK (current_index >= 0 AND current_index <= question_count);

UPDATE public.practice_sessions
SET started_at = COALESCE(started_at, completed_at, created_at)
WHERE started_at IS NULL;

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
    current_index
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
    0
  )
  RETURNING id INTO v_session;

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_practice_turn(p_session_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate uuid;
  v_session public.practice_sessions%ROWTYPE;
  v_question uuid;
  v_existing uuid;
  v_index integer;
  v_qtext text;
  v_qtype text;
  v_topic text;
  v_qdiff text;
  v_focus text[];
  v_atext text;
  v_ascore integer;
  v_summary text;
  v_answered integer;
  v_avg numeric(3,1);
  v_completed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_candidate := private.current_candidate_profile_id();
  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;

  IF p_session_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM public.practice_sessions
  WHERE id = p_session_id
    AND candidate_profile_id = v_candidate
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status IS DISTINCT FROM 'started' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  v_index := COALESCE((p_payload->>'sort_index')::integer, v_session.current_index);
  IF v_index < 0 OR v_index >= v_session.question_count THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_qtext := btrim(COALESCE(p_payload->>'question', ''));
  v_qtype := lower(btrim(COALESCE(p_payload->>'question_type', 'technical')));
  v_topic := btrim(COALESCE(p_payload->>'topic', ''));
  v_qdiff := lower(btrim(COALESCE(p_payload->>'difficulty', v_session.difficulty)));
  v_atext := btrim(COALESCE(p_payload->>'answer_text', ''));
  v_ascore := NULLIF(p_payload->>'score', '')::integer;
  v_summary := btrim(COALESCE(p_payload->>'summary', ''));

  IF v_qtext = '' OR char_length(v_qtext) > 600 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  IF v_qtype NOT IN ('technical', 'behavioral', 'system_design', 'product') THEN
    v_qtype := 'technical';
  END IF;
  IF v_qdiff NOT IN ('beginner', 'intermediate', 'advanced') THEN
    v_qdiff := v_session.difficulty;
  END IF;
  IF v_topic = '' THEN
    v_topic := v_session.interview_type;
  END IF;
  IF char_length(v_atext) < 8 OR v_ascore IS NULL OR v_ascore < 1 OR v_ascore > 10 OR char_length(v_summary) < 12 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(btrim(x)), '{}')
  INTO v_focus
  FROM (
    SELECT x
    FROM unnest(
      CASE
        WHEN jsonb_typeof(p_payload->'expected_focus') = 'array' THEN ARRAY(
          SELECT btrim(value #>> '{}')
          FROM jsonb_array_elements(p_payload->'expected_focus')
          LIMIT 5
        )
        ELSE ARRAY[]::text[]
      END
    ) AS x
    WHERE char_length(x) >= 4
  ) f;

  SELECT q.id INTO v_existing
  FROM public.practice_questions q
  WHERE q.practice_session_id = v_session.id
    AND q.sort_index = v_index;

  IF v_existing IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.practice_answers a WHERE a.practice_question_id = v_existing) THEN
      RETURN jsonb_build_object(
        'session_id', v_session.id,
        'question_id', v_existing,
        'completed', v_session.status = 'completed',
        'questions_answered', v_session.questions_answered,
        'average_score', v_session.average_score,
        'current_index', v_session.current_index
      );
    END IF;
    v_question := v_existing;
  ELSE
    INSERT INTO public.practice_questions (
      practice_session_id,
      sort_index,
      question_text,
      question_type,
      topic,
      difficulty,
      expected_focus
    )
    VALUES (
      v_session.id,
      v_index,
      left(v_qtext, 600),
      v_qtype,
      left(v_topic, 40),
      v_qdiff,
      COALESCE(v_focus, '{}')
    )
    RETURNING id INTO v_question;
  END IF;

  INSERT INTO public.practice_answers (
    practice_question_id,
    answer_text,
    score,
    strengths,
    improvements,
    missing_points,
    summary
  )
  VALUES (
    v_question,
    left(v_atext, 4000),
    v_ascore,
    COALESCE((
      SELECT array_agg(x)
      FROM (
        SELECT btrim(value #>> '{}') AS x
        FROM jsonb_array_elements(COALESCE(p_payload->'strengths', '[]'::jsonb))
        WHERE char_length(btrim(value #>> '{}')) >= 4
        LIMIT 5
      ) s
    ), '{}'),
    COALESCE((
      SELECT array_agg(x)
      FROM (
        SELECT btrim(value #>> '{}') AS x
        FROM jsonb_array_elements(COALESCE(p_payload->'improvements', '[]'::jsonb))
        WHERE char_length(btrim(value #>> '{}')) >= 4
        LIMIT 5
      ) s
    ), '{}'),
    COALESCE((
      SELECT array_agg(x)
      FROM (
        SELECT btrim(value #>> '{}') AS x
        FROM jsonb_array_elements(COALESCE(p_payload->'missing_points', '[]'::jsonb))
        WHERE char_length(btrim(value #>> '{}')) >= 4
        LIMIT 5
      ) s
    ), '{}'),
    left(v_summary, 280)
  );

  SELECT count(*)::int, round(avg(a.score)::numeric, 1)
  INTO v_answered, v_avg
  FROM public.practice_answers a
  JOIN public.practice_questions q ON q.id = a.practice_question_id
  WHERE q.practice_session_id = v_session.id;

  v_completed := v_answered >= v_session.question_count;

  UPDATE public.practice_sessions
  SET
    questions_answered = v_answered,
    average_score = v_avg,
    current_index = LEAST(v_index + 1, v_session.question_count),
    status = CASE WHEN v_completed THEN 'completed' ELSE 'started' END,
    completed_at = CASE WHEN v_completed THEN now() ELSE completed_at END
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'question_id', v_question,
    'completed', v_completed,
    'questions_answered', v_answered,
    'average_score', v_avg,
    'current_index', LEAST(v_index + 1, v_session.question_count)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_practice_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  v_candidate := private.current_candidate_profile_id();
  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'not_a_candidate' USING ERRCODE = '42501';
  END IF;
  UPDATE public.practice_sessions
  SET status = 'failed'
  WHERE id = p_session_id
    AND candidate_profile_id = v_candidate
    AND status = 'started';
END;
$$;

-- Progress metrics remain completed-only.
CREATE OR REPLACE FUNCTION public.get_practice_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate uuid;
  v_result jsonb;
BEGIN
  v_candidate := private.current_candidate_profile_id();
  IF auth.uid() IS NULL OR v_candidate IS NULL THEN
    RETURN jsonb_build_object(
      'session_count', 0,
      'questions_answered', 0,
      'average_score', NULL,
      'highest_score', NULL,
      'latest', NULL,
      'trend', '[]'::jsonb,
      'strengths', '[]'::jsonb,
      'topics_to_review', '[]'::jsonb
    );
  END IF;

  WITH sessions AS (
    SELECT *
    FROM public.practice_sessions
    WHERE candidate_profile_id = v_candidate
      AND status = 'completed'
  ),
  metrics AS (
    SELECT
      count(*)::int AS session_count,
      coalesce(sum(questions_answered), 0)::int AS questions_answered,
      round(avg(average_score)::numeric, 1) AS average_score,
      max(average_score) AS highest_score
    FROM sessions
  ),
  latest AS (
    SELECT
      id,
      target_role,
      interview_type,
      difficulty,
      average_score,
      questions_answered,
      question_count,
      completed_at
    FROM sessions
    ORDER BY completed_at DESC
    LIMIT 1
  ),
  trend AS (
    SELECT id, completed_at, average_score
    FROM (
      SELECT id, completed_at, average_score
      FROM sessions
      WHERE average_score IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 12
    ) recent
    ORDER BY completed_at ASC
  ),
  recent_answers AS (
    SELECT a.strengths, a.improvements, a.missing_points
    FROM public.practice_answers a
    JOIN public.practice_questions q ON q.id = a.practice_question_id
    WHERE q.practice_session_id IN (
      SELECT id FROM sessions ORDER BY completed_at DESC LIMIT 30
    )
  ),
  strong AS (
    SELECT btrim(theme) AS theme, count(*)::int AS n
    FROM recent_answers, unnest(strengths) AS theme
    WHERE char_length(btrim(theme)) >= 4
    GROUP BY 1
    HAVING count(*) >= 2
    ORDER BY n DESC, theme
    LIMIT 6
  ),
  review AS (
    SELECT btrim(theme) AS theme, count(*)::int AS n
    FROM recent_answers, unnest(missing_points || improvements) AS theme
    WHERE char_length(btrim(theme)) >= 4
    GROUP BY 1
    HAVING count(*) >= 2
    ORDER BY n DESC, theme
    LIMIT 6
  )
  SELECT jsonb_build_object(
    'session_count', metrics.session_count,
    'questions_answered', metrics.questions_answered,
    'average_score', metrics.average_score,
    'highest_score', metrics.highest_score,
    'latest', CASE
      WHEN latest.id IS NULL THEN NULL
      ELSE to_jsonb(latest)
    END,
    'trend', COALESCE((SELECT jsonb_agg(to_jsonb(trend) ORDER BY trend.completed_at) FROM trend), '[]'::jsonb),
    'strengths', COALESCE((SELECT jsonb_agg(theme ORDER BY n DESC, theme) FROM strong), '[]'::jsonb),
    'topics_to_review', COALESCE((SELECT jsonb_agg(theme ORDER BY n DESC, theme) FROM review), '[]'::jsonb)
  )
  INTO v_result
  FROM metrics
  LEFT JOIN latest ON true;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.start_practice_session(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_practice_turn(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fail_practice_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_practice_session(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_practice_turn(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_practice_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_practice_session(jsonb) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.save_practice_turn(uuid, jsonb) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.fail_practice_session(uuid) TO postgres, service_role;
