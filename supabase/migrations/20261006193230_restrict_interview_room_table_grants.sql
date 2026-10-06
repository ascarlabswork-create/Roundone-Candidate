-- Default privileges granted every command to authenticated.
-- Clients may only use the commands their policies cover.

REVOKE ALL ON TABLE public.interview_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.interview_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.interview_recordings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.interview_app_feedback FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.interview_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.interview_notes TO authenticated;
GRANT SELECT ON TABLE public.interview_recordings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.interview_app_feedback TO authenticated;
