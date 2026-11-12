import { skillsFromJobDescription } from '../jobMatch/extractJobSkills.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { extractTechnicalSkillsFromText } from './technicalSkills.ts'

export type AtsCheckItem = {
  id: string
  label: string
  passed: boolean
  detail: string
  weight: number
}

export type AtsReadinessResult = {
  score: number
  grade: 'strong' | 'fair' | 'needs_work'
  items: AtsCheckItem[]
  improvements: string[]
}

export type JdMatchResult = {
  score: number
  grade: 'strong' | 'fair' | 'needs_work'
  matchedSkills: string[]
  missingSkills: string[]
  resumeSkills: string[]
  jobSkills: string[]
  improvements: string[]
}

function hasEmail(text: string) {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)
}

function hasPhone(text: string) {
  return /(\+?\d[\d\s().-]{7,}\d)/.test(text)
}

function hasSection(text: string, labels: string[]) {
  const pattern = new RegExp(`(^|\\n)\\s*(${labels.join('|')})\\s*[:\\n]`, 'i')
  return pattern.test(text)
}

function gradeFor(score: number): AtsReadinessResult['grade'] {
  if (score >= 75) return 'strong'
  if (score >= 50) return 'fair'
  return 'needs_work'
}

/** Structural resume readiness for common ATS parsers — not a hiring prediction. */
export function evaluateAtsReadiness(resumeText: string): AtsReadinessResult {
  const text = resumeText.trim()
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0
  const technical = extractTechnicalSkillsFromText(text, 24)
  const bullets = (text.match(/(^|\n)\s*[-•*◦]/gm) ?? []).length
  const dates = (text.match(/\b(20\d{2}|19\d{2})\b/g) ?? []).length
  const metrics = (text.match(/\b\d+(\.\d+)?\s?(%|x|k|m|million|users|requests)\b/gi) ?? []).length

  const items: AtsCheckItem[] = [
    {
      id: 'contact-email',
      label: 'Email address',
      passed: hasEmail(text),
      detail: hasEmail(text) ? 'Email found for recruiter contact.' : 'Add a clear email near the top.',
      weight: 12,
    },
    {
      id: 'contact-phone',
      label: 'Phone number',
      passed: hasPhone(text),
      detail: hasPhone(text) ? 'Phone number detected.' : 'Add a phone number if you want recruiters to call.',
      weight: 8,
    },
    {
      id: 'skills-section',
      label: 'Skills section',
      passed: hasSection(text, ['skills', 'technical skills', 'technologies', 'tech stack']),
      detail: hasSection(text, ['skills', 'technical skills', 'technologies', 'tech stack'])
        ? 'A dedicated skills section helps parsers.'
        : 'Add a Skills / Technologies heading with keyword lists.',
      weight: 16,
    },
    {
      id: 'experience-section',
      label: 'Experience section',
      passed: hasSection(text, ['experience', 'work experience', 'employment', 'professional experience']),
      detail: hasSection(text, ['experience', 'work experience', 'employment', 'professional experience'])
        ? 'Work experience section found.'
        : 'Include an Experience heading with roles and dates.',
      weight: 16,
    },
    {
      id: 'education-section',
      label: 'Education section',
      passed: hasSection(text, ['education', 'academics', 'qualifications']),
      detail: hasSection(text, ['education', 'academics', 'qualifications'])
        ? 'Education section found.'
        : 'Add Education with degree and school.',
      weight: 10,
    },
    {
      id: 'length',
      label: 'Readable length',
      passed: words >= 180 && words <= 1200,
      detail:
        words < 180
          ? 'Resume text is short — paste the full document.'
          : words > 1200
            ? 'Very long resumes can confuse parsers — tighten to 1–2 pages of text.'
            : 'Length looks parser-friendly.',
      weight: 10,
    },
    {
      id: 'bullets',
      label: 'Bullet points',
      passed: bullets >= 4,
      detail: bullets >= 4 ? 'Bullets help ATS and humans scan achievements.' : 'Use bullet points under each role/project.',
      weight: 10,
    },
    {
      id: 'dates',
      label: 'Dates / years',
      passed: dates >= 2,
      detail: dates >= 2 ? 'Years/dates help timeline parsing.' : 'Add start–end years for roles and education.',
      weight: 8,
    },
    {
      id: 'tech-keywords',
      label: 'Technical keywords',
      passed: technical.length >= 5,
      detail:
        technical.length >= 5
          ? `${technical.length} technical skills detected in the text.`
          : 'Name concrete tools (e.g. React, SQL, SAP UI5) — not only soft skills.',
      weight: 10,
    },
  ]

  const earned = items.reduce((sum, item) => sum + (item.passed ? item.weight : 0), 0)
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  const score = total === 0 ? 0 : Math.round((earned / total) * 100)
  const improvements = items.filter((item) => !item.passed).map((item) => item.detail)
  if (metrics < 2) {
    improvements.push('Add 1–2 measurable outcomes (%, users, latency) under recent roles.')
  }

  return {
    score,
    grade: gradeFor(score),
    items,
    improvements: improvements.slice(0, 8),
  }
}

/** Keyword coverage of job skills inside resume text — suggestions only. */
export function evaluateJdMatch(resumeText: string, jobDescription: string, jobTitle = '', seedSkills: string[] = []): JdMatchResult {
  const jobSkills = skillsFromJobDescription(jobDescription, jobTitle, seedSkills)
  const resumeSkills = dedupeSkills([
    ...extractTechnicalSkillsFromText(resumeText, 30),
    ...skillsFromJobDescription(resumeText, '', []),
  ])
  const resumeKeys = new Set(resumeSkills.map((skill) => skill.toLowerCase()))
  const matchedSkills = jobSkills.filter((skill) => resumeKeys.has(skill.toLowerCase()) || mentionsSkill(resumeText, skill))
  const missingSkills = jobSkills.filter((skill) => !matchedSkills.some((item) => item.toLowerCase() === skill.toLowerCase()))
  const score = jobSkills.length === 0 ? 0 : Math.round((matchedSkills.length / jobSkills.length) * 100)

  const improvements: string[] = []
  for (const skill of missingSkills.slice(0, 6)) {
    improvements.push(`Add evidence for “${skill}” (skills list + one project/role bullet).`)
  }
  if (matchedSkills.length > 0 && missingSkills.length > 0) {
    improvements.push('Mirror exact JD wording for tools you already know — parsers prefer literal matches.')
  }
  if (jobSkills.length === 0) {
    improvements.push('Add required skills on the job review first, then re-check your resume.')
  }
  if (score >= 75 && improvements.length === 0) {
    improvements.push('Coverage looks solid — keep bullets concrete and keep formatting ATS-friendly.')
  }

  return {
    score,
    grade: gradeFor(score),
    matchedSkills,
    missingSkills,
    resumeSkills,
    jobSkills,
    improvements: improvements.slice(0, 8),
  }
}

function mentionsSkill(text: string, skill: string) {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(^|[^a-z0-9+#./])${escaped}([^a-z0-9+#./]|$)`, 'i').test(text)
}

export function atsGradeLabel(grade: AtsReadinessResult['grade']) {
  if (grade === 'strong') return 'Strong'
  if (grade === 'fair') return 'Fair'
  return 'Needs work'
}
