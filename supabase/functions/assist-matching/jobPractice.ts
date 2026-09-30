export type SafeJobContext = {
  company_name: string
  job_title: string
  description: string
  skills: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Keeps only the safe job snapshot. Drops HTML, URLs, and any other keys. */
export function readSafeJobContext(value: unknown): SafeJobContext | null {
  const row = asRecord(value)
  if (!row) return null
  const company_name = cleanText(row.company_name ?? row.companyName, 120)
  const job_title = cleanText(row.job_title ?? row.jobTitle, 160)
  const description = cleanText(row.description, 4000)
  const rawSkills = Array.isArray(row.skills) ? row.skills : []
  const skills: string[] = []
  for (const item of rawSkills) {
    const skill = cleanText(item, 40)
    if (!skill) continue
    if (skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) continue
    skills.push(skill)
    if (skills.length >= 12) break
  }
  if (!company_name && !job_title && !description && skills.length === 0) return null
  return { company_name, job_title, description, skills }
}

export function jobPracticeRules(job: SafeJobContext | null): string[] {
  if (!job) return []
  return [
    'This practice session is for a saved job. Every question is a practice question, not a question from that company\'s real interview.',
    'Use only the supplied job title, company name, job description, and required skills. Do not invent company facts, products, interview processes, or anything not in that job context.',
    'Ask questions relevant to the target role and the job requirements.',
    'When the job requires a skill such as Python or Power BI, ask questions that test that skill.',
    'When the job description mentions a domain such as machine learning, test that domain\'s concepts and practical application.',
    'Prefer the job requirements and the candidate\'s verified skills, projects, role, and level over assumptions.',
    'Never invent candidate experience, projects, employers, certifications, skills, or achievements.',
    'Never claim a question came from the real company\'s interview.',
    'topic may be one of the candidate skills or one of the job\'s required skills.',
  ]
}

export function attachJobContext<T extends Record<string, unknown>>(payload: T, job: SafeJobContext | null) {
  if (!job) return payload
  return { ...payload, job_context: job }
}
