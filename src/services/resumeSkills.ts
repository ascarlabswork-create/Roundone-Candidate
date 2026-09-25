import { supabase } from '../lib/supabase.ts'
import {
  getCandidateProfile,
  getCandidateSkills,
  updateCandidateSkills,
} from './candidateProfile.ts'

export type ResumeSkillCategory = 'extracted' | 'inferred' | 'topic' | 'manual'

export type ResumeSkillRecord = {
  id: string
  skill: string
  category: ResumeSkillCategory
  evidence_type: string | null
  evidence_detail: string | null
  accepted: boolean
}

export type ResumeProjectRecord = {
  id: string
  name: string
  description: string | null
  technologies: string[]
}

export type ResumeSkillProfile = {
  skills: ResumeSkillRecord[]
  projects: ResumeProjectRecord[]
}

export type SaveResumeSkill = {
  skill: string
  category: ResumeSkillCategory
  evidenceType?: string | null
  evidenceDetail?: string | null
}

export type SaveResumeProject = {
  name: string
  description?: string | null
  technologies?: string[]
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

const SKILL_SELECT = 'id, skill, category, evidence_type, evidence_detail, accepted'
const PROJECT_SELECT = 'id, name, description, technologies'

/** Load the candidate's saved resume-derived interview skills and projects. */
export async function getResumeSkillProfile(): Promise<ResumeSkillProfile> {
  const account = await getCandidateProfile()
  const [{ data: skills, error: skillsError }, { data: projects, error: projectsError }] =
    await Promise.all([
      supabase
        .from('candidate_resume_skills')
        .select(SKILL_SELECT)
        .eq('candidate_profile_id', account.candidate.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('candidate_resume_projects')
        .select(PROJECT_SELECT)
        .eq('candidate_profile_id', account.candidate.id)
        .order('created_at', { ascending: true }),
    ])
  fail(skillsError)
  fail(projectsError)
  return {
    skills: (skills ?? []) as ResumeSkillRecord[],
    projects: (projects ?? []) as ResumeProjectRecord[],
  }
}

/** Accepted resume skill/topic strings, used to prefill the AI interview. */
export async function getAcceptedResumeSkills(): Promise<string[]> {
  const account = await getCandidateProfile()
  const { data, error } = await supabase
    .from('candidate_resume_skills')
    .select('skill, accepted')
    .eq('candidate_profile_id', account.candidate.id)
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []).filter((row) => row.accepted).map((row) => row.skill)
}

/** Resume projects, used to ground project questions during the AI interview. */
export async function getResumeProjects(): Promise<ResumeProjectRecord[]> {
  const account = await getCandidateProfile()
  const { data, error } = await supabase
    .from('candidate_resume_projects')
    .select(PROJECT_SELECT)
    .eq('candidate_profile_id', account.candidate.id)
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []) as ResumeProjectRecord[]
}

/**
 * Persist the candidate-reviewed resume skill set and projects. This fully
 * replaces the previous resume-derived set. Accepted skill names are also
 * merged into candidate_skills so the existing AI interview / preparation flows
 * automatically use them.
 */
export async function saveResumeSkillProfile(
  skills: SaveResumeSkill[],
  projects: SaveResumeProject[],
): Promise<void> {
  const account = await getCandidateProfile()
  const candidateProfileId = account.candidate.id

  // De-duplicate skills case-insensitively (table has a unique constraint).
  const seen = new Set<string>()
  const skillRows = skills
    .map((item) => ({ ...item, skill: item.skill.trim() }))
    .filter((item) => {
      const key = item.skill.toLowerCase()
      if (!item.skill || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((item) => ({
      candidate_profile_id: candidateProfileId,
      skill: item.skill.slice(0, 60),
      category: item.category,
      evidence_type: item.evidenceType ?? null,
      evidence_detail: item.evidenceDetail ? item.evidenceDetail.slice(0, 200) : null,
      accepted: true,
    }))

  const seenProject = new Set<string>()
  const projectRows = projects
    .map((item) => ({ ...item, name: item.name.trim() }))
    .filter((item) => {
      const key = item.name.toLowerCase()
      if (!item.name || seenProject.has(key)) return false
      seenProject.add(key)
      return true
    })
    .map((item) => ({
      candidate_profile_id: candidateProfileId,
      name: item.name.slice(0, 120),
      description: item.description ? item.description.slice(0, 400) : null,
      technologies: (item.technologies ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
    }))

  // Replace the previous resume-derived skill set.
  const { error: deleteSkillsError } = await supabase
    .from('candidate_resume_skills')
    .delete()
    .eq('candidate_profile_id', candidateProfileId)
  fail(deleteSkillsError)

  if (skillRows.length > 0) {
    const { error } = await supabase.from('candidate_resume_skills').insert(skillRows)
    fail(error)
  }

  // Replace the previous resume projects.
  const { error: deleteProjectsError } = await supabase
    .from('candidate_resume_projects')
    .delete()
    .eq('candidate_profile_id', candidateProfileId)
  fail(deleteProjectsError)

  if (projectRows.length > 0) {
    const { error } = await supabase.from('candidate_resume_projects').insert(projectRows)
    fail(error)
  }

  // Merge accepted skill names into the candidate's profile skill set so the
  // rest of the app (AI practice / preparation prefill) uses them.
  const existing = await getCandidateSkills()
  const merged = [...new Set([...existing, ...skillRows.map((row) => row.skill)])]
  await updateCandidateSkills(merged)
}
