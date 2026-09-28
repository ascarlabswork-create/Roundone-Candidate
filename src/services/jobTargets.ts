import { supabase } from '../lib/supabase.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { getCandidateProfile } from './candidateProfile.ts'
import type { JobSourceType } from './jobAnalysis.ts'

export type JobTargetStatus = 'draft' | 'analyzed' | 'ready'

export type JobTarget = {
  id: string
  candidateProfileId: string
  sourceUrl: string | null
  sourceType: JobSourceType
  jobId: string | null
  companyName: string | null
  jobTitle: string | null
  description: string | null
  skills: string[]
  status: JobTargetStatus
  createdAt: string
  updatedAt: string
}

export type JobTargetInput = {
  sourceUrl?: string | null
  sourceType: JobSourceType
  jobId?: string | null
  companyName?: string | null
  jobTitle?: string | null
  description?: string | null
  skills: string[]
  status?: JobTargetStatus
}

const SELECT =
  'id, candidate_profile_id, source_url, source_type, job_id, company_name, job_title, description, skills, status, created_at, updated_at'

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message || 'Unable to save this job.')
}

function mapTarget(value: unknown): JobTarget | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.candidate_profile_id !== 'string') return null
  const sourceType = row.source_type === 'manual' ? 'manual' : 'url'
  const status = row.status === 'ready' || row.status === 'analyzed' || row.status === 'draft' ? row.status : 'draft'
  const skills = Array.isArray(row.skills) ? row.skills.filter((item): item is string => typeof item === 'string') : []
  return {
    id: row.id,
    candidateProfileId: row.candidate_profile_id,
    sourceUrl: typeof row.source_url === 'string' ? row.source_url : null,
    sourceType,
    jobId: typeof row.job_id === 'string' ? row.job_id : null,
    companyName: typeof row.company_name === 'string' ? row.company_name : null,
    jobTitle: typeof row.job_title === 'string' ? row.job_title : null,
    description: typeof row.description === 'string' ? row.description : null,
    skills: dedupeSkills(skills),
    status,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }
}

function toRow(input: JobTargetInput, candidateProfileId: string) {
  return {
    candidate_profile_id: candidateProfileId,
    source_url: input.sourceType === 'manual' ? null : input.sourceUrl ?? null,
    source_type: input.sourceType,
    job_id: input.jobId ?? null,
    company_name: input.companyName ?? null,
    job_title: input.jobTitle ?? null,
    description: input.description ?? null,
    skills: dedupeSkills(input.skills),
    status: input.status ?? 'draft',
  }
}

export async function listJobTargets(): Promise<JobTarget[]> {
  const account = await getCandidateProfile()
  const { data, error } = await supabase
    .from('candidate_job_targets')
    .select(SELECT)
    .eq('candidate_profile_id', account.candidate.id)
    .order('updated_at', { ascending: false })
  fail(error)
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const mapped = mapTarget(row)
    return mapped ? [mapped] : []
  })
}

export async function getJobTarget(id: string): Promise<JobTarget | null> {
  const { data, error } = await supabase.from('candidate_job_targets').select(SELECT).eq('id', id).maybeSingle()
  fail(error)
  return mapTarget(data)
}

export async function createJobTarget(input: JobTargetInput): Promise<JobTarget> {
  const account = await getCandidateProfile()
  const { data, error } = await supabase
    .from('candidate_job_targets')
    .insert(toRow(input, account.candidate.id))
    .select(SELECT)
    .single()
  fail(error)
  const mapped = mapTarget(data)
  if (!mapped) throw new Error('Unable to save this job.')
  return mapped
}

export async function updateJobTarget(id: string, input: JobTargetInput): Promise<JobTarget> {
  const account = await getCandidateProfile()
  const { data, error } = await supabase
    .from('candidate_job_targets')
    .update(toRow(input, account.candidate.id))
    .eq('id', id)
    .select(SELECT)
    .single()
  fail(error)
  const mapped = mapTarget(data)
  if (!mapped) throw new Error('Unable to save this job.')
  return mapped
}

export async function deleteJobTarget(id: string): Promise<void> {
  const { error } = await supabase.from('candidate_job_targets').delete().eq('id', id)
  fail(error)
}
