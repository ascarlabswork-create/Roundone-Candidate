import { extractExplicitSkills } from '../../supabase/functions/analyze-job/extract.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { extractTechnicalSkillsFromText } from '../resume/technicalSkills.ts'

const MAX_JOB_SKILLS = 20

/** JD-only phrases — may be added to EXTRA_TECHNICAL_SKILLS over time; kept here for job posting vocabulary. */
const JOB_SKILL_PHRASES = [
  'SAP UI5 Development',
  'SAP UI5',
  'SAP Fiori',
  'UI5 Development',
  'ABAP',
  'Fiori',
] as const

const GENERIC_ROLE_SKILLS = new Set([
  'software engineering',
  'software engineer',
  'custom software engineer',
  'engineering',
  'development',
])

function groundedPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text)
}

function skillsFromJobPhrases(text: string) {
  const found: string[] = []
  for (const phrase of JOB_SKILL_PHRASES) {
    if (!groundedPhrase(text, phrase)) continue
    if (found.some((item) => item.toLowerCase() === phrase.toLowerCase())) continue
    found.push(phrase)
  }
  return found
}

function extractMustHaveBlock(text: string) {
  const normalized = text.replace(/\r\n/g, '\n')
  const patterns = [
    /must[- ]have\s+skills?:?\s*([\s\S]*?)(?=\n\s*(?:good[- ]to[- ]have|nice[- ]to[- ]have|responsibilities|qualifications|what you|about you|job\s*#|location|$))/i,
    /required\s+skills?:?\s*([\s\S]*?)(?=\n\s*(?:good|preferred|nice|responsibilities|$))/i,
  ]
  const found: string[] = []
  for (const pattern of patterns) {
    const match = pattern.exec(normalized)
    if (!match) continue
    for (const line of match[1].split('\n')) {
      const cleaned = line.replace(/^[\s•\-*◦\d.)]+/, '').trim()
      if (cleaned.length < 3 || cleaned.length > 64) continue
      if (/^(must have|required|skills)/i.test(cleaned) && cleaned.length < 24) continue
      found.push(cleaned.replace(/\s+/g, ' '))
    }
  }
  return found
}

function pruneGenericRoleSkills(skills: string[], jobTitle: string) {
  const title = jobTitle.trim().toLowerCase()
  const specific = skills.filter((skill) => {
    const key = skill.trim().toLowerCase()
    if (GENERIC_ROLE_SKILLS.has(key)) return false
    if (title && key === title) return false
    if (title.includes('software') && (key === 'software engineering' || key === 'software engineer')) return false
    return true
  })
  return specific.length > 0 ? specific : skills
}

/** Merge server-extracted skills with catalog and heading-style matches from the JD text. */
export function skillsFromJobDescription(description: string, jobTitle = '', seed: string[] = []) {
  const text = [jobTitle, description].filter(Boolean).join('\n\n').trim()
  if (!text) return dedupeSkills(seed).slice(0, MAX_JOB_SKILLS)
  const explicit = extractExplicitSkills(text, [...JOB_SKILL_PHRASES])
  const catalog = extractTechnicalSkillsFromText(text, MAX_JOB_SKILLS)
  const phrases = skillsFromJobPhrases(text)
  const mustHave = extractMustHaveBlock(description)
  const merged = dedupeSkills([...seed, ...explicit, ...catalog, ...phrases, ...mustHave]).slice(0, MAX_JOB_SKILLS)
  return pruneGenericRoleSkills(merged, jobTitle)
}
