import { supabase } from '../lib/supabase.ts'
import { asRecord, readBoolean, readNullableString, readNumber, readString } from '../lib/rows.ts'
import { paiseToMajorUnits } from '../lib/format.ts'
import type { MatchingCatalogPerson } from '../matching/catalog.ts'
import type { SkillMatchDetail } from '../types.ts'

export const MATCH_INTERVIEWERS_FOR_JOB_RPC = 'match_interviewers_for_job'

export type JobMatchRow = {
  interviewerProfileId: string
  fullName: string
  avatarUrl: string | null
  headline: string | null
  bio: string | null
  currentRole: string | null
  company: string | null
  experienceYears: number
  timezone: string
  languages: string[]
  skills: string[]
  matchedJobSkills: string[]
  missingJobSkills: string[]
  extraInterviewerSkills: string[]
  skillRatio: number
  skillPercent: number
  ratingAvg: number | null
  reviewCount: number
  completedInterviewsCount: number
  isOnline: boolean
  listPricePaise: number | null
  currency: string
  isListed: boolean
}

export type JobMatchPage = {
  page: number
  pageSize: number
  total: number
  results: JobMatchRow[]
  reason: string | null
}

function readStringList(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

export function mapJobMatchRow(value: unknown): JobMatchRow | null {
  const row = asRecord(value)
  if (!row) return null
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const fullName = readString(row, 'full_name')
  const timezone = readString(row, 'timezone')
  const skillRatio = readNumber(row, 'skill_ratio')
  const skillPercent = readNumber(row, 'skill_percent')
  if (!interviewerProfileId || !fullName || !timezone || skillRatio == null || skillPercent == null) return null
  return {
    interviewerProfileId,
    fullName,
    avatarUrl: readNullableString(row, 'avatar_url'),
    headline: readNullableString(row, 'headline'),
    bio: readNullableString(row, 'bio'),
    currentRole: readNullableString(row, 'current_role'),
    company: readNullableString(row, 'company'),
    experienceYears: readNumber(row, 'experience_years') ?? 0,
    timezone,
    languages: readStringList(row, 'languages'),
    skills: readStringList(row, 'skills'),
    matchedJobSkills: readStringList(row, 'matched_job_skills'),
    missingJobSkills: readStringList(row, 'missing_job_skills'),
    extraInterviewerSkills: readStringList(row, 'extra_interviewer_skills'),
    skillRatio,
    skillPercent,
    ratingAvg: readNumber(row, 'rating_avg'),
    reviewCount: readNumber(row, 'review_count') ?? 0,
    completedInterviewsCount: readNumber(row, 'completed_interviews_count') ?? 0,
    isOnline: readBoolean(row, 'is_online') ?? false,
    listPricePaise: readNumber(row, 'list_price_paise'),
    currency: 'INR',
    isListed: readBoolean(row, 'is_listed') ?? false,
  }
}

export function parseJobMatchPage(value: unknown): JobMatchPage | null {
  const row = asRecord(value)
  if (!row || !Array.isArray(row.results)) return null
  const page = readNumber(row, 'page')
  const pageSize = readNumber(row, 'page_size')
  const total = readNumber(row, 'total')
  if (page == null || pageSize == null || total == null) return null
  return {
    page,
    pageSize,
    total,
    results: row.results.flatMap((item) => {
      const mapped = mapJobMatchRow(item)
      return mapped ? [mapped] : []
    }),
    reason: readNullableString(row, 'reason'),
  }
}

export function jobMatchToCatalogPerson(row: JobMatchRow): MatchingCatalogPerson {
  const price = row.listPricePaise != null ? paiseToMajorUnits(row.listPricePaise) : 0
  return {
    id: row.interviewerProfileId,
    name: row.fullName,
    photo: row.avatarUrl ?? '',
    currentRole: row.currentRole ?? row.headline ?? 'Interviewer',
    company: row.company ?? '',
    experienceYears: row.experienceYears,
    skills: row.skills,
    technologies: [],
    interviewTypes: [],
    candidateLevels: [],
    targetRoles: [],
    rating: row.ratingAvg ?? 0,
    reviewCount: row.reviewCount,
    completedInterviews: row.completedInterviewsCount,
    price,
    currency: 'INR',
    services: [],
    availability: {
      timezone: row.timezone,
      bookingBufferMin: 0,
      recurring: [],
      custom: [],
      blocked: [],
    },
    isOnline: row.isOnline,
    verification: { identity: false, employment: false, linkedin: false },
    bio: row.bio ?? row.headline ?? '',
    previousCompanies: [],
    languages: row.languages,
    timezone: row.timezone,
    headline: row.headline,
  }
}

export function jobMatchDetail(row: JobMatchRow): SkillMatchDetail {
  return {
    matchedSkills: row.matchedJobSkills,
    candidateMissingSkills: row.missingJobSkills,
    interviewerExtraSkills: row.extraInterviewerSkills,
    ratio: row.skillRatio,
    percent: row.skillPercent,
  }
}

export async function matchInterviewersForJob(input: {
  skills: string[]
  page?: number
  pageSize?: number
  search?: string
}): Promise<JobMatchPage> {
  const { data, error } = await supabase.rpc(MATCH_INTERVIEWERS_FOR_JOB_RPC, {
    p_job_skills: input.skills,
    p_page: input.page ?? 1,
    p_page_size: input.pageSize ?? 20,
    p_search: input.search?.trim() || null,
  })
  if (error) throw new Error(error.message || 'Unable to find interviewers for this job.')
  const parsed = parseJobMatchPage(data)
  if (!parsed) throw new Error('Unable to find interviewers for this job.')
  return parsed
}
