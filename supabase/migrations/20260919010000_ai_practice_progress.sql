-- AI practice history. Completed sessions only.
-- Candidate identity is taken from auth via private.current_candidate_profile_id(),
-- never from a client-supplied candidate_profile_id.

CREATE TABLE public.practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  target_role text NOT NULL,
  interview_type text NOT NULL,
  difficulty text NOT NULL,
  topics text[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL,
  questions_answered integer NOT NULL DEFAULT 0,
  average_score numeric(3,1),
  status text NOT NULL DEFAULT 'completed',
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_sessions_difficulty_chk CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  CONSTRAINT practice_sessions_status_chk CHECK (status = 'completed'),
  CONSTRAINT practice_sessions_question_count_chk CHECK (question_count BETWEEN 1 AND 8),
  CONSTRAINT practice_sessions_answered_chk CHECK (
    questions_answered >= 0 AND questions_answered <= question_count
  ),
  CONSTRAINT practice_sessions_score_chk CHECK (
    average_score IS NULL OR (average_score >= 1 AND average_score <= 10)
  )
);

CREATE INDEX practice_sessions_candidate_completed_idx
  ON public.practice_sessions (candidate_profile_id, completed_at DESC);

CREATE TABLE public.practice_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_session_id uuid NOT NULL REFERENCES public.practice_sessions (id) ON DELETE CASCADE,
  sort_index integer NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  topic text NOT NULL,
  difficulty text NOT NULL,
  expected_focus text[] NOT NULL DEFAULT '{}',
  CONSTRAINT practice_questions_sort_chk CHECK (sort_index >= 0),
  CONSTRAINT practice_questions_type_chk CHECK (
    question_type IN ('technical', 'behavioral', 'system_design', 'product')
  ),
  UNIQUE (practice_session_id, sort_index)
);

CREATE INDEX practice_questions_session_idx ON public.practice_questions (practice_session_id);

CREATE TABLE public.practice_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_question_id uuid NOT NULL REFERENCES public.practice_questions (id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  score smallint NOT NULL,
  strengths text[] NOT NULL DEFAULT '{}',
  improvements text[] NOT NULL DEFAULT '{}',
  missing_points text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_answers_score_chk CHECK (score BETWEEN 1 AND 10),
  CONSTRAINT practice_answers_one_per_question UNIQUE (practice_question_id)
);

CREATE INDEX practice_answers_question_idx ON public.practice_answers (practice_question_id);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY practice_sessions_select_own ON public.practice_sessions
  FOR SELECT TO authenticated
  USING (private.owns_candidate_profile(candidate_profile_id));

CREATE POLICY practice_questions_select_own ON public.practice_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.practice_sessions s
      WHERE s.id = practice_session_id
        AND private.owns_candidate_profile(s.candidate_profile_id)
    )
  );

CREATE POLICY practice_answers_select_own ON public.practice_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.practice_questions q
      JOIN public.practice_sessions s ON s.id = q.practice_session_id
      WHERE q.id = practice_question_id
        AND private.owns_candidate_profile(s.candidate_profile_id)
    )
  );
