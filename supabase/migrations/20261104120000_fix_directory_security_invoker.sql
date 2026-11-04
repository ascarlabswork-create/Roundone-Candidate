-- Keep the public interviewer directory runnable as the view owner so
-- signed-in candidates can open skill-matched interviewers who are not listed yet.
ALTER VIEW public.interviewer_public_directory SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_services_public SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_skills_public SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_roles_public SET (security_barrier = true, security_invoker = false);
