import { extractExplicitSkills } from '../../supabase/functions/analyze-job/extract.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { extractTechnicalSkillsFromText } from '../resume/technicalSkills.ts'

const MAX_JOB_SKILLS = 20

/** Merge server-extracted skills with catalog and heading-style matches from the JD text. */
export function skillsFromJobDescription(description: string, jobTitle = '', seed: string[] = []) {
  const text = [jobTitle, description].filter(Boolean).join('\n\n').trim()
  if (!text) return dedupeSkills(seed).slice(0, MAX_JOB_SKILLS)
  const explicit = extractExplicitSkills(text)
  const catalog = extractTechnicalSkillsFromText(text, MAX_JOB_SKILLS)
  return dedupeSkills([...seed, ...explicit, ...catalog]).slice(0, MAX_JOB_SKILLS)
}
