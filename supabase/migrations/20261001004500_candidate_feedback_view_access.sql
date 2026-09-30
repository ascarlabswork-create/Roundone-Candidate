-- The candidate feedback view must run as its owner. Table RLS only lets the
-- interviewer read interviewer_feedback, so an invoker view hides submitted
-- feedback from the candidate. internal_notes stays off this view.

ALTER VIEW public.interviewer_feedback_for_candidate
  SET (security_barrier = true, security_invoker = false);

REVOKE ALL ON public.interviewer_feedback_for_candidate FROM PUBLIC, anon;
GRANT SELECT ON public.interviewer_feedback_for_candidate TO authenticated;
