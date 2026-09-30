-- Candidate reviews were stored as pending, and this app has no moderation screen,
-- so a submitted review never appeared on the interviewer profile. Publish them.
-- The public view must run as its owner: table RLS only lets the author, the
-- interviewer, or an admin read candidate_reviews.

CREATE OR REPLACE FUNCTION private.protect_review_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'approved'::public.moderation_status;
    NEW.moderation_admin_id := NULL;
    NEW.moderated_at := now();
    RETURN NEW;
  END IF;

  IF (
    OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
    OR OLD.moderation_admin_id IS DISTINCT FROM NEW.moderation_admin_id
    OR OLD.moderated_at IS DISTINCT FROM NEW.moderated_at
  ) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Only admins can moderate reviews'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    NEW.moderation_admin_id := auth.uid();
    NEW.moderated_at := now();
  END IF;

  IF OLD.written_review IS DISTINCT FROM NEW.written_review
     OR OLD.overall_rating IS DISTINCT FROM NEW.overall_rating
     OR OLD.display_name IS DISTINCT FROM NEW.display_name THEN
    IF NOT private.is_admin() THEN
      RAISE EXCEPTION 'Reviews are immutable after submit'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.candidate_reviews DISABLE TRIGGER candidate_reviews_protect;

UPDATE public.candidate_reviews
SET
  moderation_status = 'approved'::public.moderation_status,
  moderated_at = COALESCE(moderated_at, now())
WHERE moderation_status = 'pending'::public.moderation_status;

ALTER TABLE public.candidate_reviews ENABLE TRIGGER candidate_reviews_protect;

ALTER VIEW public.candidate_reviews_public
  SET (security_barrier = true, security_invoker = false);

REVOKE ALL ON public.candidate_reviews_public FROM PUBLIC;
GRANT SELECT ON public.candidate_reviews_public TO anon, authenticated;
