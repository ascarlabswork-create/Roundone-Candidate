-- Candidate profile/booking was broken for skill-matched interviewers who are
-- not yet is_listed. Match RPC (SECURITY DEFINER) still returned them, but the
-- public views were running as security_invoker=on, so base-table RLS hid the
-- rows from candidates. Result: "Interviewer not found" on View Profile and
-- "Booking not available yet" even when active services exist.
--
-- These views define their own access rule (listed OR signed-in candidate with
-- skills). They must run as the view owner so that predicate is the gate.

ALTER VIEW public.interviewer_public_directory SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_services_public SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_skills_public SET (security_barrier = true, security_invoker = false);
ALTER VIEW public.interviewer_roles_public SET (security_barrier = true, security_invoker = false);
