-- Candidates may SELECT own rows via RLS. Writes go through save_completed_practice_session.
-- Anon must not execute the SECURITY DEFINER RPCs.

REVOKE ALL ON FUNCTION public.save_completed_practice_session(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_practice_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_completed_practice_session(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_practice_progress() TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.practice_sessions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.practice_questions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.practice_answers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.practice_sessions TO authenticated;
GRANT SELECT ON public.practice_questions TO authenticated;
GRANT SELECT ON public.practice_answers TO authenticated;
REVOKE ALL ON TABLE public.practice_sessions FROM anon;
REVOKE ALL ON TABLE public.practice_questions FROM anon;
REVOKE ALL ON TABLE public.practice_answers FROM anon;
