CREATE OR REPLACE FUNCTION public.save_completed_practice_session(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate uuid;
  v_session uuid;
  v_question uuid;
  v_item jsonb;
  v_answer jsonb;
  v_index integer := 0;
  v_answered integer := 0;
  v_score_sum integer := 0;
  v_role text;
  v_type text;
  v_difficulty text;
  v_topics text[];
  v_count integer;
  v_qtext text;
  v_qtype text;
  v_topic text;
  v_qdiff text;
  v_focus text[];
  v_atext text;
  v_ascore integer;
  v_summary text;
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
  IF jsonb_typeof(p_payload->'questions') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_payload->'questions') < 1 OR jsonb_array_length(p_payload->'questions') > 8 THEN
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
    status
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
    'completed'
  )
  RETURNING id INTO v_session;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_payload->'questions')
  LOOP
    v_qtext := btrim(COALESCE(v_item->>'question', ''));
    v_qtype := lower(btrim(COALESCE(v_item->>'question_type', 'technical')));
    v_topic := btrim(COALESCE(v_item->>'topic', ''));
    v_qdiff := lower(btrim(COALESCE(v_item->>'difficulty', v_difficulty)));
    IF v_qtext = '' OR char_length(v_qtext) > 600 THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END IF;
    IF v_qtype NOT IN ('technical', 'behavioral', 'system_design', 'product') THEN
      v_qtype := 'technical';
    END IF;
    IF v_qdiff NOT IN ('beginner', 'intermediate', 'advanced') THEN
      v_qdiff := v_difficulty;
    END IF;
    IF v_topic = '' THEN
      v_topic := v_type;
    END IF;

    SELECT COALESCE(array_agg(btrim(x)), '{}')
    INTO v_focus
    FROM (
      SELECT x
      FROM unnest(
        CASE
          WHEN jsonb_typeof(v_item->'expected_focus') = 'array' THEN ARRAY(
            SELECT btrim(value #>> '{}')
            FROM jsonb_array_elements(v_item->'expected_focus')
            LIMIT 5
          )
          ELSE ARRAY[]::text[]
        END
      ) AS x
      WHERE char_length(x) >= 4
    ) f;

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
      v_session,
      v_index,
      left(v_qtext, 600),
      v_qtype,
      left(v_topic, 40),
      v_qdiff,
      COALESCE(v_focus, '{}')
    )
    RETURNING id INTO v_question;

    v_answer := v_item->'answer';
    IF v_answer IS NOT NULL AND jsonb_typeof(v_answer) = 'object' THEN
      v_atext := btrim(COALESCE(v_answer->>'answer_text', ''));
      v_ascore := NULLIF(v_answer->>'score', '')::integer;
      v_summary := btrim(COALESCE(v_answer->>'summary', ''));
      IF char_length(v_atext) >= 8 AND v_ascore BETWEEN 1 AND 10 AND char_length(v_summary) >= 12 THEN
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
              FROM jsonb_array_elements(COALESCE(v_answer->'strengths', '[]'::jsonb))
              WHERE char_length(btrim(value #>> '{}')) >= 4
              LIMIT 5
            ) s
          ), '{}'),
          COALESCE((
            SELECT array_agg(x)
            FROM (
              SELECT btrim(value #>> '{}') AS x
              FROM jsonb_array_elements(COALESCE(v_answer->'improvements', '[]'::jsonb))
              WHERE char_length(btrim(value #>> '{}')) >= 4
              LIMIT 5
            ) s
          ), '{}'),
          COALESCE((
            SELECT array_agg(x)
            FROM (
              SELECT btrim(value #>> '{}') AS x
              FROM jsonb_array_elements(COALESCE(v_answer->'missing_points', '[]'::jsonb))
              WHERE char_length(btrim(value #>> '{}')) >= 4
              LIMIT 5
            ) s
          ), '{}'),
          left(v_summary, 280)
        );
        v_answered := v_answered + 1;
        v_score_sum := v_score_sum + v_ascore;
      END IF;
    END IF;

    v_index := v_index + 1;
    EXIT WHEN v_index >= v_count;
  END LOOP;

  UPDATE public.practice_sessions
  SET
    questions_answered = v_answered,
    average_score = CASE
      WHEN v_answered > 0 THEN round((v_score_sum::numeric / v_answered), 1)
      ELSE NULL
    END
  WHERE id = v_session;

  RETURN v_session;
END;
$$;

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

REVOKE ALL ON FUNCTION public.save_completed_practice_session(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_practice_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_completed_practice_session(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_practice_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_completed_practice_session(jsonb) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.get_practice_progress() TO postgres, service_role;

GRANT SELECT ON public.practice_sessions TO authenticated;
GRANT SELECT ON public.practice_questions TO authenticated;
GRANT SELECT ON public.practice_answers TO authenticated;
GRANT ALL ON public.practice_sessions TO postgres, service_role;
GRANT ALL ON public.practice_questions TO postgres, service_role;
GRANT ALL ON public.practice_answers TO postgres, service_role;
