-- These views are the candidate-facing projection. Base-table RLS only lets an
-- interviewer read their own services, so security_invoker hid every session from
-- candidates and the booking page treated saved availability as "not available yet".
-- The view predicate stays the access rule: listed interviewers for everyone, and
-- active skill-matched interviewers for a signed-in candidate.

ALTER VIEW public.interviewer_public_directory SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_services_public SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_skills_public SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_roles_public SET (security_barrier = true, security_invoker = false);
