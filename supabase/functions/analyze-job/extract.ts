import { SKILL_PHRASES } from './skillPhrases.ts'

export type ExtractedJob = {
  company_name: string | null
  job_title: string | null
  job_id: string | null
  description: string | null
  skills: string[]
  source_url: string | null
  source_type: 'url' | 'manual'
}

const SOFT_SKILLS = new Set([
  'communication',
  'communications',
  'team player',
  'teamwork',
  'hard working',
  'hardworking',
  'leadership',
  'passionate',
  'motivated',
  'interpersonal',
  'fast learner',
])

const MAX_DESCRIPTION = 8000

export function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
}

export function visibleText(html: string) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]*(cookie|consent|banner)[^>]*>[\s\S]*?<\/[^>]+>/gi, ' ')
  const withBreaks = withoutNoise
    .replace(/<(\/p|\/div|\/li|\/h[1-6]|br)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return collapseText(stripTags(withBreaks))
}

function collapseText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function metaContent(html: string, key: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    'i',
  )
  const match = html.match(pattern)
  const value = match?.[1] || match?.[2] || ''
  return collapseText(stripTags(value)) || null
}

function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? collapseText(stripTags(match[1])) || null : null
}

type JsonLdJob = {
  title?: string
  description?: string
  identifier?: string
  company?: string
  skills: string[]
}

function readJsonLdJobs(html: string): JsonLdJob[] {
  const jobs: JsonLdJob[] = []
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    try {
      collectJobs(JSON.parse(match[1]), jobs)
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return jobs
}

function collectJobs(value: unknown, jobs: JsonLdJob[]) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => collectJobs(item, jobs))
    return
  }
  const row = value as Record<string, unknown>
  const type = row['@type']
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? '')]
  if (types.some((item) => item.toLowerCase() === 'jobposting')) {
    const org = row.hiringOrganization
    const orgRow = org && typeof org === 'object' ? (org as Record<string, unknown>) : null
    const identifier = row.identifier
    let jobId: string | undefined
    if (typeof identifier === 'string') jobId = identifier
    else if (identifier && typeof identifier === 'object') {
      const idRow = identifier as Record<string, unknown>
      if (typeof idRow.value === 'string') jobId = idRow.value
    }
    const skills = Array.isArray(row.skills)
      ? row.skills.filter((item): item is string => typeof item === 'string')
      : typeof row.skills === 'string'
        ? [row.skills]
        : []
    jobs.push({
      title: typeof row.title === 'string' ? collapseText(stripTags(row.title)) : undefined,
      description: typeof row.description === 'string' ? collapseText(stripTags(row.description)) : undefined,
      identifier: jobId ? collapseText(jobId) : undefined,
      company: orgRow && typeof orgRow.name === 'string' ? collapseText(stripTags(orgRow.name)) : undefined,
      skills,
    })
  }
  if (Array.isArray(row['@graph'])) collectJobs(row['@graph'], jobs)
}

function phrasePattern(phrase: string) {
  const escaped = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '[\\s._-]+')
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i')
}

export function mentionsPhrase(text: string, phrase: string) {
  return phrasePattern(phrase).test(text)
}

function isSoftSkill(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ')
  if (SOFT_SKILLS.has(normalized)) return true
  const words = normalized.split(' ').filter(Boolean)
  return words.length > 0 && words.every((word) => SOFT_SKILLS.has(word) || word === 'skill' || word === 'skills')
}

function headingSkills(text: string) {
  const lines = text.split('\n')
  const found: string[] = []
  let capture = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^(skills|required skills|requirements|qualifications|technologies|tech stack)\b/i.test(trimmed) && trimmed.length < 80) {
      capture = true
      const inline = trimmed.split(':').slice(1).join(':')
      if (inline.trim()) found.push(...splitSkillList(inline))
      continue
    }
    if (capture && /^(about|responsibilities|benefits|company|description)\b/i.test(trimmed) && trimmed.length < 40) {
      capture = false
    }
    if (capture) found.push(...splitSkillList(trimmed.replace(/^[-*•]\s*/, '')))
  }
  return found
}

function splitSkillList(value: string) {
  return value
    .split(/,|\/|\band\b|•|;|\|/i)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter((item) => item.length >= 2 && item.length <= 40 && item.split(/\s+/).length <= 4)
}

export function extractExplicitSkills(text: string, phrases: string[] = SKILL_PHRASES) {
  const found: string[] = []
  const add = (value: string) => {
    const skill = value.trim().replace(/\s+/g, ' ')
    if (!skill || isSoftSkill(skill)) return
    if (!mentionsPhrase(text, skill) && !mentionsPhrase(text, skill.replace(/\s+/g, ''))) return
    if (found.some((item) => item.toLowerCase() === skill.toLowerCase())) return
    found.push(skill)
  }
  const ordered = [...phrases].sort((a, b) => b.length - a.length)
  for (const phrase of ordered) {
    if (mentionsPhrase(text, phrase)) add(phrase)
  }
  for (const item of headingSkills(text)) add(item)
  return found
}

export function extractJobFromHtml(html: string, sourceUrl: string | null, jobIdHint?: string | null): ExtractedJob {
  const jobs = readJsonLdJobs(html)
  const job = jobs[0]
  const text = visibleText(html)
  const description = clip(job?.description || metaContent(html, 'og:description') || metaContent(html, 'description') || text)
  const title = job?.title || metaContent(html, 'og:title') || pageTitle(html)
  const company = job?.company || metaContent(html, 'og:site_name')
  const skills = uniqueSkills([...(job?.skills ?? []), ...extractExplicitSkills(`${title ?? ''}\n${description ?? ''}\n${text}`)])
  return {
    company_name: emptyToNull(company),
    job_title: emptyToNull(title),
    job_id: emptyToNull(job?.identifier || jobIdHint || null),
    description,
    skills,
    source_url: sourceUrl,
    source_type: 'url',
  }
}

export function extractJobFromManual(description: string, jobIdHint?: string | null): ExtractedJob {
  const text = collapseText(description).slice(0, MAX_DESCRIPTION)
  return {
    company_name: null,
    job_title: null,
    job_id: emptyToNull(jobIdHint || null),
    description: text || null,
    skills: extractExplicitSkills(text),
    source_url: null,
    source_type: 'manual',
  }
}

export function groundAnalysis(base: ExtractedJob, suggestion: Record<string, unknown>, sourceText: string): ExtractedJob {
  const company = groundedString(suggestion.company_name ?? suggestion.companyName, sourceText)
  const title = groundedString(suggestion.job_title ?? suggestion.jobTitle, sourceText)
  const description = groundedString(suggestion.description, sourceText)
  const jobId = groundedString(suggestion.job_id ?? suggestion.jobId, sourceText)
  const suggestedSkills = Array.isArray(suggestion.skills) ? suggestion.skills : []
  const skills = uniqueSkills([
    ...base.skills,
    ...suggestedSkills
      .filter((item): item is string => typeof item === 'string')
      .filter((item) => mentionsPhrase(sourceText, item) && !isSoftSkill(item)),
  ])
  return {
    company_name: base.company_name ?? company,
    job_title: base.job_title ?? title,
    job_id: base.job_id ?? jobId,
    description: base.description ?? (description ? clip(description) : null),
    skills,
    source_url: base.source_url,
    source_type: base.source_type,
  }
}

function groundedString(value: unknown, sourceText: string) {
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\s+/g, ' ')
  if (!text || text.length > 500) return null
  if (!sourceText.toLowerCase().includes(text.toLowerCase())) return null
  return text
}

function uniqueSkills(values: string[]) {
  const result: string[] = []
  for (const value of values) {
    const skill = value.trim().replace(/\s+/g, ' ')
    if (!skill || isSoftSkill(skill)) continue
    if (result.some((item) => item.toLowerCase() === skill.toLowerCase())) continue
    result.push(skill)
  }
  return result.slice(0, 40)
}

function emptyToNull(value: string | null | undefined) {
  const text = value?.trim() ?? ''
  return text ? text.slice(0, 200) : null
}

function clip(value: string | null) {
  if (!value) return null
  return value.length > MAX_DESCRIPTION ? value.slice(0, MAX_DESCRIPTION) : value
}

export const UNREADABLE_JOB_MESSAGE =
  'This job page could not be read. Try a public job URL or paste the job description manually.'
