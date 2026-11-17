SELECT
  position('DELETE FROM public.candidate_profiles' in pg_get_functiondef('public.claim_interviewer_persona()'::regprocedure)) AS claim_still_deletes_candidate,
  position('INSERT INTO public.interviewer_profiles' in pg_get_functiondef('public.claim_interviewer_persona()'::regprocedure)) AS claim_adds_interviewer,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_candidate_persona'
  ) AS has_claim_candidate;
