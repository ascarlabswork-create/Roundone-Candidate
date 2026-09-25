export const RESUME_AI_FUNCTION = 'assist-matching'
export const RESUME_AI_MODE = 'resume_skill_plan'
export const RESUME_AI_TIMEOUT_MS = 20_000
export const RESUME_TEXT_MAX = 14_000
export const RESUME_TEXT_MIN = 60

export const RESUME_EVIDENCE_TYPES = [
  'skills_section',
  'project',
  'experience',
  'certification',
  'education',
  'tools',
  'summary',
] as const

export type ResumeEvidenceType = (typeof RESUME_EVIDENCE_TYPES)[number]

/** How a reviewable interview skill was derived from the resume. */
export type ResumeSkillCategory = 'extracted' | 'inferred' | 'topic' | 'manual'

const RESUME_BANNED =
  /\b(guaranteed|job-ready|hiring probability|employability|will get (you )?hired|recruiter score|ats score)\b/i

export type ResumeSkill = {
  /** The skill / technology / topic text. */
  skill: string
  category: ResumeSkillCategory
  evidenceType: ResumeEvidenceType | null
  /** The resume section, project name, experience entry, or certification it came from. */
  evidenceDetail: string
  /** For inferred skills: the explicit project/experience phrase it was inferred from. */
  inferredFrom?: string
  /** For derived interview topics: which accepted skills it derives from. */
  derivedFrom?: string[]
}

export type ResumeProject = {
  name: string
  description: string
  technologies: string[]
}

export type ResumeExperience = {
  title: string
  summary: string
  technologies: string[]
}

export type ResumeSkillPlan = {
  profileSummary: string
  extractedSkills: ResumeSkill[]
  inferredSkills: ResumeSkill[]
  interviewTopics: ResumeSkill[]
  projects: ResumeProject[]
  experiences: ResumeExperience[]
  certifications: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readTrimmed(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function uniqueStrings(values: unknown, maxItems: number, maxLen: number, minLen = 1) {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const item of values) {
    const text = readTrimmed(item, maxLen)
    if (text.length < minLen || RESUME_BANNED.test(text)) continue
    if (result.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue
    result.push(text)
    if (result.length >= maxItems) break
  }
  return result
}

function readEvidenceType(value: unknown): ResumeEvidenceType | null {
  const v = readTrimmed(value, 40).toLowerCase().replace(/\s+/g, '_')
  return (RESUME_EVIDENCE_TYPES as readonly string[]).includes(v) ? (v as ResumeEvidenceType) : null
}

export function canAnalyzeResume(resumeText: string) {
  return resumeText.trim().length >= RESUME_TEXT_MIN
}

export function parseResumeSkillPlan(value: unknown): ResumeSkillPlan | null {
  const row = asRecord(value)
  if (!row) return null

  const profileSummary = (() => {
    const s = readTrimmed(row.profile_summary ?? row.profileSummary, 400)
    return RESUME_BANNED.test(s) ? '' : s
  })()

  const seen = new Set<string>()

  const parseSkillRows = (raw: unknown, category: 'extracted' | 'inferred'): ResumeSkill[] => {
    const list = Array.isArray(raw) ? raw : []
    const out: ResumeSkill[] = []
    for (const item of list) {
      const r = asRecord(item)
      if (!r) continue
      const skill = readTrimmed(r.skill, 40)
      if (skill.length < 2 || RESUME_BANNED.test(skill)) continue
      const key = skill.toLowerCase()
      if (seen.has(key)) continue
      const inferredFrom = readTrimmed(r.inferred_from ?? r.inferredFrom, 200)
      const evidenceDetail = readTrimmed(r.evidence_detail ?? r.evidenceDetail, 160) || inferredFrom
      seen.add(key)
      out.push({
        skill,
        category,
        evidenceType: readEvidenceType(r.evidence_type ?? r.evidenceType),
        evidenceDetail,
        inferredFrom: category === 'inferred' ? inferredFrom : undefined,
      })
      if (out.length >= 30) break
    }
    return out
  }

  const extractedSkills = parseSkillRows(row.extracted_skills ?? row.extractedSkills, 'extracted')
  const inferredSkills = parseSkillRows(row.inferred_skills ?? row.inferredSkills, 'inferred')

  const acceptedKeys = new Set<string>([...seen])

  const interviewTopics: ResumeSkill[] = []
  const rawTopics = Array.isArray(row.interview_topics)
    ? row.interview_topics
    : Array.isArray(row.interviewTopics)
      ? row.interviewTopics
      : []
  for (const item of rawTopics) {
    const r = asRecord(item)
    if (!r) continue
    const topic = readTrimmed(r.topic, 60)
    if (topic.length < 2 || RESUME_BANNED.test(topic)) continue
    const key = topic.toLowerCase()
    if (interviewTopics.some((t) => t.skill.toLowerCase() === key)) continue
    const derivedFrom = uniqueStrings(r.derived_from ?? r.derivedFrom, 6, 40).filter((s) =>
      acceptedKeys.has(s.toLowerCase()),
    )
    if (derivedFrom.length === 0) continue
    interviewTopics.push({
      skill: topic,
      category: 'topic',
      evidenceType: null,
      evidenceDetail: readTrimmed(r.rationale, 200),
      derivedFrom,
    })
    if (interviewTopics.length >= 12) break
  }

  const projects: ResumeProject[] = []
  const rawProjects = Array.isArray(row.projects) ? row.projects : []
  for (const item of rawProjects) {
    const r = asRecord(item)
    if (!r) continue
    const name = readTrimmed(r.name ?? r.title, 120)
    if (name.length < 2) continue
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) continue
    projects.push({
      name,
      description: readTrimmed(r.description ?? r.summary, 400),
      technologies: uniqueStrings(r.technologies ?? r.tech ?? r.stack, 12, 40, 1),
    })
    if (projects.length >= 10) break
  }

  const experiences: ResumeExperience[] = []
  const rawExperiences = Array.isArray(row.experiences) ? row.experiences : []
  for (const item of rawExperiences) {
    const r = asRecord(item)
    if (!r) continue
    const title = readTrimmed(r.title ?? r.role ?? r.organization ?? r.company, 160)
    const summary = readTrimmed(r.summary ?? r.description, 400)
    if (title.length < 2 && summary.length < 2) continue
    experiences.push({
      title,
      summary,
      technologies: uniqueStrings(r.technologies ?? r.tech ?? r.stack, 12, 40, 1),
    })
    if (experiences.length >= 10) break
  }

  const certifications = uniqueStrings(row.certifications, 12, 120, 2)

  if (
    extractedSkills.length === 0 &&
    inferredSkills.length === 0 &&
    projects.length === 0 &&
    experiences.length === 0
  ) {
    return null
  }

  return {
    profileSummary,
    extractedSkills,
    inferredSkills,
    interviewTopics,
    projects,
    experiences,
    certifications,
  }
}

/** Human-readable label for an evidence type. */
export function evidenceTypeLabel(type: ResumeEvidenceType | null): string {
  switch (type) {
    case 'skills_section':
      return 'Skills section'
    case 'project':
      return 'Project'
    case 'experience':
      return 'Experience'
    case 'certification':
      return 'Certification'
    case 'education':
      return 'Education'
    case 'tools':
      return 'Tools'
    case 'summary':
      return 'Summary'
    default:
      return 'Resume'
  }
}
