import { extractTechnicalSkillsFromText } from './technicalSkills.ts'
import { normalizeResumeText } from './atsCheck.ts'
import { dedupeSkills } from '../matching/skills.ts'

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
}

const ROLE_TAIL =
  /\s+(?:Senior\s+|Lead\s+|Principal\s+)?(?:DevOps|Software|Cloud|Platform|SRE|Full[\s-]?Stack|Backend|Frontend|Data|ML|AI)?\s*(?:Engineer|Developer|Architect|Analyst|Consultant|Manager|Intern).*$/i

const SECTION_STOP =
  'Professional Summary|Summary|Profile|About|Key Achievements|Achievements|Technical Skills|Skills|Technologies|Tech Stack|Tools|Work Experience|Professional Experience|Experience|Education|Projects|Certifications|Awards|SUMMARY|SKILLS|EXPERIENCE|EDUCATION'

function firstLineName(text: string) {
  const lines = text.split('\n').map((item) => item.trim()).filter(Boolean)
  for (const line of lines.slice(0, 5)) {
    if (line.length < 3 || line.length > 90) continue
    if (/@|https?:|linkedin\.com|\bphone\b/i.test(line)) continue
    if (/^(summary|skills|experience|education|projects|professional)\b/i.test(line)) continue
    const beforeRole = line.replace(ROLE_TAIL, '').trim()
    const tokens = beforeRole.split(/\s+/).filter(Boolean)
    while (
      tokens.length > 2 &&
      /^(Mumbai|Delhi|Bengaluru|Bangalore|Hyderabad|Pune|Chennai|Kolkata|India|USA|UK|Remote)$/i.test(tokens[tokens.length - 1] ?? '')
    ) {
      tokens.pop()
    }
    if (tokens.length >= 2 && tokens.length <= 5) return tokens.join(' ').slice(0, 60)
  }
  return lines[0]?.replace(ROLE_TAIL, '').trim().slice(0, 60) || 'Your Name'
}

function pullContact(text: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const phone = text.match(/(\+?\d[\d\s().-]{8,}\d)/)?.[0]
  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)|]+/i)?.[0]
  return [email, phone, linkedin ? linkedin.replace(/^(?!https?:)/i, 'https://') : null].filter(
    (item): item is string => Boolean(item),
  )
}

function sectionBody(text: string, labels: string[]) {
  const alt = labels.map((label) => label.replace(/\s+/g, '\\s+')).join('|')
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:${alt})\\s*(?:\\n|:)+([\\s\\S]*?)(?=(?:\\n\\s*(?:${SECTION_STOP})\\b)|$)`,
    'i',
  )
  const match = pattern.exec(text)
  return match?.[1]?.trim() ?? ''
}

function bulletsFrom(block: string) {
  if (!block.trim()) return []
  const fromMarks = block
    .split(/\n/)
    .map((line) => line.replace(/^[-*•▪▸►◦\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 18 && line.length <= 280)
  if (fromMarks.length >= 2) return fromMarks.slice(0, 14)

  const sentences = block
    .split(/(?<=[.!?])\s+|(?=\b(?:Built|Led|Managed|Developed|Implemented|Designed|Migrated|Automated|Created|Improved|Reduced|Increased)\b)/)
    .map((line) => line.replace(/^[-*•▪▸►◦\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 24 && line.length <= 280)
  return sentences.slice(0, 12)
}

function roleTitleHint(text: string) {
  const match = text.match(
    /\b((?:Senior\s+)?(?:DevOps|Software|Cloud|Platform|SRE|Full[\s-]?Stack|Backend|Frontend)\s+Engineer|Software Developer|SDE(?:\s*[123])?)\b/i,
  )
  return match?.[1]?.trim() ?? ''
}

function cleanSkillList(skills: string[]) {
  const banned = new Set([
    'experience',
    'education',
    'skills',
    'summary',
    'projects',
    'professional',
    'work experience',
    'technical skills',
  ])
  return skills.filter((skill) => {
    const key = skill.toLowerCase().trim()
    if (banned.has(key)) return false
    if (/^\d{4}$/.test(key)) return false
    if (key.length > 48) return false
    return true
  })
}

export function parseResumeForTemplate(raw: string): ParsedResume {
  const text = normalizeResumeText(raw)
  const skills = cleanSkillList(dedupeSkills(extractTechnicalSkillsFromText(text, 30))).slice(0, 28)

  let summary = sectionBody(text, ['professional summary', 'summary', 'profile', 'about me', 'about'])
  summary = summary.replace(/\s+/g, ' ').trim().slice(0, 520)
  if (!summary) {
    const role = roleTitleHint(text)
    const years = text.match(/\b(\d+\+?\s+years?)\b/i)?.[1]
    if (role || years) {
      summary = [role, years ? `with ${years} of experience` : '', skills.slice(0, 6).join(', ')]
        .filter(Boolean)
        .join(' — ')
        .slice(0, 280)
    }
  }

  const experienceBlock =
    sectionBody(text, ['work experience', 'professional experience', 'work history', 'experience', 'employment']) ||
    text
  const educationBlock = sectionBody(text, ['education', 'academics', 'qualifications'])

  const experience = bulletsFrom(experienceBlock)
    .filter((line) => !/^(skills|education|summary|professional)\b/i.test(line))
    .slice(0, 10)

  return {
    name: firstLineName(text),
    contact: pullContact(text),
    summary,
    skills,
    experience,
    education: bulletsFrom(educationBlock).slice(0, 4),
  }
}

function inferTargetRole(jobDescription: string, missingSkills: string[]) {
  const text = jobDescription.trim()
  if (!text) return missingSkills[0] ? `${missingSkills[0]} roles` : 'this role'
  const titled =
    text.match(
      /\b((?:Senior\s+|Lead\s+)?(?:SAP\s+)?(?:UI5|Fiori|ABAP|DevOps|Software|Full[\s-]?Stack|Frontend|Backend|Cloud|Platform)\s+(?:Developer|Engineer|Consultant|Architect))\b/i,
    )?.[1] ?? text.match(/\b(SAP\s+UI5(?:\s+Development)?)\b/i)?.[1]
  return titled?.trim() || (missingSkills[0] ? `${missingSkills[0]} roles` : 'this role')
}

function buildJdTailoredSummary(
  baseSummary: string,
  matched: string[],
  missing: string[],
  presentSkills: string[],
  jobDescription: string,
) {
  const target = inferTargetRole(jobDescription, missing)
  const strengths = (matched.length > 0 ? matched : presentSkills).slice(0, 6).join(', ')
  if (missing.length === 0) {
    return (
      baseSummary ||
      `Candidate for ${target}. Strengths: ${strengths || 'core technical skills from this resume'}.`
    )
  }
  return [
    `Targeting ${target}.`,
    strengths ? `Transferable strengths already on this resume: ${strengths}.` : null,
    `Gap vs this JD — add real evidence (skills + project bullets) for: ${missing.slice(0, 6).join(', ')}. Do not list tools you have not used.`,
  ]
    .filter(Boolean)
    .join(' ')
}

/** Rebuild resume text in an ATS-friendly template. With a JD, rewrites toward that role honestly. */
export function formatResumeWithTemplate(
  raw: string,
  templateId: AtsTemplateId,
  options?: {
    missingJobSkills?: string[]
    matchedJobSkills?: string[]
    jobDescription?: string
    suggestions?: string[]
  },
): string {
  const parsed = parseResumeForTemplate(raw)
  const missing = (options?.missingJobSkills ?? []).filter(
    (skill) =>
      !parsed.skills.some(
        (item) => item.toLowerCase() === skill.toLowerCase() || item.toLowerCase().includes(skill.toLowerCase()),
      ),
  )
  const matched = (options?.matchedJobSkills ?? []).filter(Boolean)
  const jobDescription = options?.jobDescription ?? ''
  const hasJdTailor = Boolean(jobDescription.trim() || missing.length || matched.length)

  const presentSkills = dedupeSkills([
    ...matched,
    ...parsed.skills.filter((skill) => !missing.some((gap) => gap.toLowerCase() === skill.toLowerCase())),
  ]).slice(0, 22)

  const contact = parsed.contact.join(' · ') || 'Add email · phone · LinkedIn'
  const summary = hasJdTailor
    ? buildJdTailoredSummary(parsed.summary, matched, missing, presentSkills, jobDescription)
    : parsed.summary || 'Add a 2–3 line summary focused on the role you want next.'
  const rankedExperience =
    hasJdTailor && jobDescription.trim().length >= 40
      ? [...parsed.experience].sort((a, b) => {
          const score = (line: string) => {
            const lower = line.toLowerCase()
            let points = 0
            for (const skill of matched) {
              if (skill && lower.includes(skill.toLowerCase())) points += 3
            }
            for (const token of jobDescription.toLowerCase().split(/[^a-z0-9+#./]+/).slice(0, 30)) {
              if (token.length >= 3 && lower.includes(token)) points += 1
            }
            return points
          }
          return score(b) - score(a)
        })
      : parsed.experience
  const experience =
    rankedExperience.length > 0
      ? rankedExperience.map((line) => `• ${line}`).join('\n')
      : '• Add 3–5 role bullets with tools and outcomes (action + result).'
  const education =
    parsed.education.length > 0 ? parsed.education.map((line) => `• ${line}`).join('\n') : '• Degree, school, year'

  const skillsBlock = hasJdTailor
    ? [
        missing.length > 0
          ? `Target keywords for this JD (add only with real evidence): ${missing.slice(0, 8).join(', ')}`
          : null,
        `Skills on resume: ${presentSkills.join(', ') || 'Add technical skills'}`,
      ]
        .filter(Boolean)
        .join('\n')
    : presentSkills.join(', ') || 'Add technical skills'

  const nextSteps =
    hasJdTailor && (missing.length > 0 || (options?.suggestions?.length ?? 0) > 0)
      ? [
          'NEXT STEPS FOR THIS JD',
          ...missing.slice(0, 4).map((skill) => `• Add a bullet proving ${skill} (project, module, or production use).`),
          ...(options?.suggestions ?? [])
            .filter((item) => !missing.some((skill) => item.includes(skill)))
            .slice(0, 3)
            .map((item) => `• ${item}`),
        ].join('\n')
      : ''

  if (templateId === 'compact') {
    return [
      parsed.name,
      contact,
      '',
      'SKILLS',
      hasJdTailor ? skillsBlock.replace(/\n/g, '\n') : presentSkills.join(' · ') || 'Add technical skills as a comma-separated list',
      '',
      'SUMMARY',
      summary,
      '',
      'EXPERIENCE',
      experience,
      '',
      'EDUCATION',
      education,
      nextSteps ? `\n${nextSteps}` : '',
    ]
      .filter((line) => line !== '')
      .join('\n')
  }

  if (templateId === 'impact') {
    const impact =
      parsed.experience
        .filter((line) => /\d|%|users|latency|cost|saved|improved|reduced|increased/i.test(line))
        .slice(0, 4)
        .map((line) => `• ${line}`)
        .join('\n') || experience
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
      skillsBlock,
      '',
      'EXPERIENCE',
      experience,
      '',
      'EDUCATION',
      education,
      nextSteps ? `\n${nextSteps}` : '',
    ]
      .filter((line) => line !== '')
      .join('\n')
  }

  return [
    parsed.name,
    contact,
    '',
    'SUMMARY',
    summary,
    '',
    'SKILLS',
    skillsBlock,
    '',
    'EXPERIENCE',
    experience,
    '',
    'EDUCATION',
    education,
    nextSteps ? `\n${nextSteps}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}
