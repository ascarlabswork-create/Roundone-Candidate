import { extractTechnicalSkillsFromText } from './technicalSkills.ts'
import { normalizeResumeText } from './atsCheck.ts'

export type AtsTemplateId = 'classic' | 'compact' | 'impact'

export type AtsTemplate = {
  id: AtsTemplateId
  name: string
  blurb: string
  bestFor: string
}

export const ATS_TEMPLATES: AtsTemplate[] = [
  {
    id: 'classic',
    name: 'Classic ATS',
    blurb: 'Single column, clear headings, parser-friendly order.',
    bestFor: 'Most job boards and LinkedIn Easy Apply',
  },
  {
    id: 'compact',
    name: 'Compact skills',
    blurb: 'Skills block up front, shorter bullets, dense but scannable.',
    bestFor: 'Technical roles with many tools',
  },
  {
    id: 'impact',
    name: 'Impact first',
    blurb: 'Leads with measurable wins, then roles and skills.',
    bestFor: 'Senior / results-heavy profiles',
  },
]

type ParsedResume = {
  name: string
  contact: string[]
  summary: string
  skills: string[]
  experience: string[]
  education: string[]
  other: string[]
}

function firstLineName(text: string) {
  const line = text.split('\n').map((item) => item.trim()).find(Boolean) ?? ''
  if (line.length < 3 || line.length > 60) return 'Your Name'
  if (/@|http|skills|experience|summary/i.test(line)) return 'Your Name'
  return line
}

function pullContact(text: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const phone = text.match(/(\+?\d[\d\s().-]{8,}\d)/)?.[0]
  const linkedin = text.match(/linkedin\.com\/[^\s)]+/i)?.[0]
  return [email, phone, linkedin ? `https://${linkedin.replace(/^https?:\/\//i, '')}` : null].filter(
    (item): item is string => Boolean(item),
  )
}

function sectionBody(text: string, labels: string[]) {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:${labels.map((label) => label.replace(/\s+/g, '\\s+')).join('|')})\\s*[:\\n]+([\\s\\S]*?)(?=(?:\\n\\s*(?:summary|skills|experience|education|projects|certifications)\\b)|$)`,
    'i',
  )
  const match = pattern.exec(text)
  return match?.[1]?.trim() ?? ''
}

function bulletsFrom(block: string) {
  const lines = block
    .split(/\n|•|▪|▸/)
    .map((line) => line.replace(/^[-*◦\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 12)
  return lines.slice(0, 14)
}

export function parseResumeForTemplate(raw: string): ParsedResume {
  const text = normalizeResumeText(raw)
  const skills = extractTechnicalSkillsFromText(text, 24)
  const summary =
    sectionBody(text, ['summary', 'professional summary', 'profile', 'about']) ||
    text.split('\n').map((line) => line.trim()).filter((line) => line.length > 40).slice(0, 1)[0] ||
    ''
  const experienceBlock = sectionBody(text, ['experience', 'work experience', 'professional experience', 'employment'])
  const educationBlock = sectionBody(text, ['education', 'academics', 'qualifications'])
  return {
    name: firstLineName(text),
    contact: pullContact(text),
    summary: summary.slice(0, 500),
    skills,
    experience: bulletsFrom(experienceBlock || text).slice(0, 10),
    education: bulletsFrom(educationBlock).slice(0, 4),
    other: [],
  }
}

/** Rebuild resume text in an ATS-friendly template. Optional JD skills are appended if missing. */
export function formatResumeWithTemplate(
  raw: string,
  templateId: AtsTemplateId,
  options?: { missingJobSkills?: string[] },
): string {
  const parsed = parseResumeForTemplate(raw)
  const missing = (options?.missingJobSkills ?? []).filter(
    (skill) => !parsed.skills.some((item) => item.toLowerCase() === skill.toLowerCase()),
  )
  const skills = [...parsed.skills, ...missing].slice(0, 28)
  const contact = parsed.contact.join(' · ')
  const summary = parsed.summary || 'Add a 2–3 line summary focused on the role you want next.'
  const experience =
    parsed.experience.length > 0
      ? parsed.experience.map((line) => `• ${line}`).join('\n')
      : '• Add 3–5 role bullets with tools and outcomes.'
  const education =
    parsed.education.length > 0 ? parsed.education.map((line) => `• ${line}`).join('\n') : '• Degree, school, year'

  if (templateId === 'compact') {
    return [
      parsed.name,
      contact,
      '',
      'SKILLS',
      skills.join(' · ') || 'Add technical skills as a comma-separated list',
      '',
      'SUMMARY',
      summary,
      '',
      'EXPERIENCE',
      experience,
      '',
      'EDUCATION',
      education,
    ].join('\n')
  }

  if (templateId === 'impact') {
    const impact = parsed.experience.slice(0, 4).map((line) => `• ${line}`).join('\n') || experience
    return [
      parsed.name,
      contact,
      '',
      'KEY IMPACT',
      impact,
      '',
      'SUMMARY',
      summary,
      '',
      'SKILLS',
      skills.join(', ') || 'Add technical skills',
      '',
      'EXPERIENCE',
      experience,
      '',
      'EDUCATION',
      education,
    ].join('\n')
  }

  return [
    parsed.name,
    contact,
    '',
    'SUMMARY',
    summary,
    '',
    'SKILLS',
    skills.join(', ') || 'Add technical skills',
    '',
    'EXPERIENCE',
    experience,
    '',
    'EDUCATION',
    education,
  ].join('\n')
}
