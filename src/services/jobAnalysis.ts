import { supabase } from '../lib/supabase.ts'
import { preserveReviewedSkills } from '../jobMatch/review.ts'
import { dedupeSkills } from '../matching/skills.ts'

export const ANALYZE_JOB_FUNCTION = 'analyze-job'

export const UNREADABLE_JOB_MESSAGE =
  'This job page could not be read. Try a public job URL or paste the job description manually.'

export type JobSourceType = 'url' | 'manual'

export type JobAnalysis = {
  companyName: string | null
  jobTitle: string | null
  jobId: string | null
  description: string | null
  skills: string[]
  sourceUrl: string | null
  sourceType: JobSourceType
}

export class JobAnalysisError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readNullable(value: unknown, max = 8000) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text.slice(0, max) : null
}

export function parseJobAnalysis(value: unknown): JobAnalysis | null {
  const row = asRecord(value)
  if (!row) return null
  const sourceType = row.source_type === 'manual' ? 'manual' : row.source_type === 'url' ? 'url' : null
  if (!sourceType) return null
  const skills = Array.isArray(row.skills) ? row.skills.filter((item): item is string => typeof item === 'string') : []
  if ('html' in row) return null
  return {
    companyName: readNullable(row.company_name, 200),
    jobTitle: readNullable(row.job_title, 200),
    jobId: readNullable(row.job_id, 80),
    description: readNullable(row.description, 8000),
    skills: dedupeSkills(skills),
    sourceUrl: sourceType === 'manual' ? null : readNullable(row.source_url, 2000),
    sourceType,
  }
}

async function invoke(body: Record<string, unknown>): Promise<JobAnalysis> {
  const { data, error } = await supabase.functions.invoke(ANALYZE_JOB_FUNCTION, { body })
  if (error) {
    const context = asRecord((error as { context?: unknown }).context)
    const payload = asRecord(data) ?? context
    const message = typeof payload?.message === 'string' ? payload.message : ''
    if (message) throw new JobAnalysisError(String(payload?.error ?? 'unreadable'), message)
    throw new JobAnalysisError('unreadable', UNREADABLE_JOB_MESSAGE)
  }
  const parsed = parseJobAnalysis(data)
  if (!parsed) throw new JobAnalysisError('malformed', 'The job analysis response could not be read.')
  return parsed
}

export function analyzeJobUrl(url: string, jobId?: string) {
  return invoke({ mode: 'url', url, job_id: jobId?.trim() || null })
}

export function analyzeJobText(description: string, jobId?: string) {
  return invoke({ mode: 'manual', description, job_id: jobId?.trim() || null })
}

export { preserveReviewedSkills }
