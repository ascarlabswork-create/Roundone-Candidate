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
  wordCount: number
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

/** Title-case / ALL-CAPS headings only — avoids splitting on “years of experience”. */
const SECTION_HEADERS =
  'Professional Summary|Key Achievements|Technical Skills|Core Competencies|Work Experience|Professional Experience|Work History|Tech Stack|About Me|' +
  'SUMMARY|SKILLS|EXPERIENCE|EDUCATION|PROJECTS|CERTIFICATIONS|AWARDS|PROFILE|ACHIEVEMENTS|TECHNOLOGIES|TOOLS|EMPLOYMENT|QUALIFICATIONS|ACADEMICS|LANGUAGES|' +
  'Summary|Profile|Achievements|Skills|Technologies|Tools|Experience|Employment|Education|Projects|Certifications|Certification|Awards|Languages|Qualifications|Academics'

/** Normalize PDF/OCR quirks and re-insert section breaks for flattened extracts. */
export function normalizeResumeText(raw: string) {
  let text = raw
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/mailto:/gi, ' ')
    .replace(/\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+/gi, '@')
    .replace(/\[\s*dot\s*\]|\(\s*dot\s*\)/gi, '.')
    .replace(/([A-Za-z0-9._%+-])\s+@\s+([A-Za-z0-9.-])/g, '$1@$2')
    .replace(/([A-Za-z0-9-])\s+\.\s+([A-Za-z]{2,})/g, '$1.$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')

  // PDF extractors often drop newlines before headings — restore them (case-sensitive).
  text = text.replace(
    new RegExp(`(?<=\\S)\\s+(${SECTION_HEADERS})(?=\\s*[:|]|\\s+(?:[A-Z•▪\\d]|https?))`, 'g'),
    (_match, heading: string) => `\n\n${heading.trim()}\n`,
  )
  // Break before common role/date patterns that start experience blocks.
  text = text.replace(
    /\s+(\d{1,2}[\/\-]\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b/gi,
    '\n$1',
  )
  text = text.replace(/\s+[•▪▸►]\s+/g, '\n• ')
  text = text.replace(
    /(?<=[.!?])\s+(?=(?:Built|Led|Managed|Developed|Implemented|Designed|Migrated|Automated|Created|Improved|Reduced|Increased)\b)/g,
    '\n• ',
  )

  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function hasEmail(text: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)
}

function hasPhone(text: string) {
  return /(\+?\d[\d\s().-]{8,}\d)|(\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b)/.test(text)
}

/** PDF extractors often drop newlines — match headings in-line too. */
function hasHeading(text: string, labels: string[]) {
  const alt = labels.map((label) => label.replace(/\s+/g, '\\s+')).join('|')
  return new RegExp(`(^|[\\n•|]|\\s)(${alt})(\\s*[:|]|\\s*$|\\s+(?=[A-Z0-9]))`, 'im').test(text)
}

function hasExperienceSignal(text: string) {
  if (hasHeading(text, ['experience', 'work experience', 'employment', 'professional experience', 'work history'])) {
    return true
  }
  return /\b(software engineer|devops engineer|sde|developer|intern)\b/i.test(text) && /\b(20\d{2}|19\d{2})\b/.test(text)
}

function hasEducationSignal(text: string) {
  if (hasHeading(text, ['education', 'academics', 'qualifications', 'academic'])) return true
  return /\b(b\.?\s?tech|b\.?\s?e\.?|m\.?\s?tech|bachelor|master|university|college|cgpa|gpa)\b/i.test(text)
}

function hasSkillsSignal(text: string, techCount: number) {
  if (hasHeading(text, ['skills', 'technical skills', 'technologies', 'tech stack', 'core competencies', 'tools'])) {
    return true
  }
  return techCount >= 8
}

function bulletCount(text: string) {
  const classic = (text.match(/(^|\n)\s*[-•*◦▪▸►]/gm) ?? []).length
  const inline = (text.match(/\s[•▪▸►]\s/g) ?? []).length
  const numbered = (text.match(/(^|\n)\s*\d+[.)]\s+\S/gm) ?? []).length
  // Flattened PDFs often lose markers — count achievement-style sentences as soft bullets.
  const actionSentences =
    classic + inline + numbered >= 3
      ? 0
      : (text.match(/\b(?:Built|Led|Managed|Developed|Implemented|Designed|Migrated|Automated|Created|Improved|Reduced|Increased)\b[^.!\n]{12,}[.!]/gi) ?? [])
          .length
  return classic + inline + numbered + actionSentences
}

function gradeFor(score: number): AtsReadinessResult['grade'] {
  if (score >= 75) return 'strong'
  if (score >= 50) return 'fair'
  return 'needs_work'
}

/** Drop near-duplicate job skills (e.g. SAP UI5 + SAP UI5 Development). */
export function collapseRelatedSkills(skills: string[]) {
  const ordered = dedupeSkills(skills).sort((a, b) => b.length - a.length)
  const kept: string[] = []
  for (const skill of ordered) {
    const key = skill.toLowerCase()
    const covered = kept.some((existing) => {
      const other = existing.toLowerCase()
      return other.includes(key) || key.includes(other)
    })
    if (!covered) kept.push(skill)
  }
  return kept
}

/** Structural resume readiness for common ATS parsers — not a hiring prediction. */
export function evaluateAtsReadiness(resumeText: string): AtsReadinessResult {
  const text = normalizeResumeText(resumeText)
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0
  const technical = extractTechnicalSkillsFromText(text, 30)
  const bullets = bulletCount(text)
  const dates = (text.match(/\b(20\d{2}|19\d{2})\b/g) ?? []).length
  const metrics = (
    text.match(
      /\b\d+(\.\d+)?\s?(?:%|x|k\+?|m\+?|million|billion|users|requests|latency|ms|sec|hrs?|hours?|days?|weeks?|months?|servers?|pipelines?)(?!\w)|\b\d+\+?\s+years?\b/gi,
    ) ?? []
  ).length
  const emailOk = hasEmail(text)
  const phoneOk = hasPhone(text)
  const skillsOk = hasSkillsSignal(text, technical.length)
  const experienceOk = hasExperienceSignal(text)
  const educationOk = hasEducationSignal(text)
  // PDF text is often denser than page count; allow a wider band.
  const lengthOk = words >= 120 && words <= 2800

  const items: AtsCheckItem[] = [
    {
      id: 'contact-email',
      label: 'Email address',
      passed: emailOk,
      detail: emailOk ? 'Email found for recruiter contact.' : 'Add a clear email near the top of the resume.',
      weight: 12,
    },
    {
      id: 'contact-phone',
      label: 'Phone number',
      passed: phoneOk,
      detail: phoneOk ? 'Phone number detected.' : 'Add a phone number if you want recruiters to call.',
      weight: 8,
    },
    {
      id: 'skills-section',
      label: 'Skills section',
      passed: skillsOk,
      detail: skillsOk
        ? technical.length >= 8 && !hasHeading(text, ['skills', 'technical skills', 'technologies', 'tech stack', 'tools'])
          ? `${technical.length} technical keywords found (add a clear Skills heading if missing).`
          : 'Skills / tools section detected.'
        : 'Add a Skills / Technologies heading with keyword lists.',
      weight: 16,
    },
    {
      id: 'experience-section',
      label: 'Experience section',
      passed: experienceOk,
      detail: experienceOk ? 'Work experience signals found.' : 'Include Experience with roles and dates.',
      weight: 16,
    },
    {
      id: 'education-section',
      label: 'Education section',
      passed: educationOk,
      detail: educationOk ? 'Education signals found.' : 'Add Education with degree and school.',
      weight: 10,
    },
    {
      id: 'length',
      label: 'Readable length',
      passed: lengthOk,
      detail:
        words < 120
          ? 'Resume text is short — paste or upload the full document.'
          : words > 2800
            ? 'Extracted text is very long — trim to about 1–2 pages of core content.'
            : `About ${words} words — parser-friendly length.`,
      weight: 10,
    },
    {
      id: 'bullets',
      label: 'Bullet points',
      passed: bullets >= 3,
      detail: bullets >= 3 ? 'Bullet / list markers help scanners.' : 'Use bullet points under each role or project.',
      weight: 10,
    },
    {
      id: 'dates',
      label: 'Dates / years',
      passed: dates >= 2 || (dates >= 1 && /\b\d+\+?\s+years?\b/i.test(text)),
      detail:
        dates >= 2 || (dates >= 1 && /\b\d+\+?\s+years?\b/i.test(text))
          ? 'Years/dates help timeline parsing.'
          : 'Add start–end years for roles and education.',
      weight: 8,
    },
    {
      id: 'tech-keywords',
      label: 'Technical keywords',
      passed: technical.length >= 5,
      detail:
        technical.length >= 5
          ? `${technical.length} technical skills detected in the text.`
          : 'Name concrete tools (e.g. React, SQL, AWS) — not only soft skills.',
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
    wordCount: words,
  }
}

/** Keyword coverage of job skills inside resume text — suggestions only. */
export function evaluateJdMatch(resumeText: string, jobDescription: string, jobTitle = '', seedSkills: string[] = []): JdMatchResult {
  const text = normalizeResumeText(resumeText)
  const jobSkills = collapseRelatedSkills(skillsFromJobDescription(jobDescription, jobTitle, seedSkills))
  const resumeSkills = collapseRelatedSkills([
    ...extractTechnicalSkillsFromText(text, 40),
    ...skillsFromJobDescription(text, '', []),
  ])
  const matchedSkills = jobSkills.filter((skill) => mentionsSkill(text, skill) || resumeSkills.some((item) => skillsOverlap(item, skill)))
  const missingSkills = jobSkills.filter((skill) => !matchedSkills.some((item) => skillsOverlap(item, skill)))
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

function skillsOverlap(a: string, b: string) {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  return left === right || left.includes(right) || right.includes(left)
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
