-- Resume-derived interview skill set + resume projects.
-- These store the candidate-reviewed output of resume analysis so the AI
-- Interview can generate questions and follow-ups from resume-supported facts
-- only. Candidate identity is enforced by RLS (owner via
-- private.owns_candidate_profile), matching candidate_skills.

CREATE TABLE public.candidate_resume_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  skill text NOT NULL,
  category text NOT NULL DEFAULT 'extracted',
  evidence_type text,
  evidence_detail text,
  accepted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_resume_skills_category_chk CHECK (
    category IN ('extracted', 'inferred', 'topic', 'manual')
  ),
  CONSTRAINT candidate_resume_skills_evidence_chk CHECK (
    evidence_type IS NULL OR evidence_type IN (
      'skills_section', 'project', 'experience', 'certification', 'education', 'tools', 'summary'
    )
  ),
  UNIQUE (candidate_profile_id, skill)
);

CREATE INDEX candidate_resume_skills_candidate_idx
  ON public.candidate_resume_skills (candidate_profile_id, created_at);

CREATE TABLE public.candidate_resume_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  technologies text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, name)
);

CREATE INDEX candidate_resume_projects_candidate_idx
  ON public.candidate_resume_projects (candidate_profile_id, created_at);

ALTER TABLE public.candidate_resume_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_resume_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_resume_skills_crud ON public.candidate_resume_skills
  FOR ALL TO authenticated
  USING (private.owns_candidate_profile(candidate_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_candidate_profile(candidate_profile_id) OR private.is_admin());

CREATE POLICY candidate_resume_projects_crud ON public.candidate_resume_projects
  FOR ALL TO authenticated
  USING (private.owns_candidate_profile(candidate_profile_id) OR private.is_admin())
  WITH CHECK (private.owns_candidate_profile(candidate_profile_id) OR private.is_admin());

REVOKE ALL ON TABLE
  public.candidate_resume_skills,
  public.candidate_resume_projects
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_resume_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_resume_projects TO authenticated;
