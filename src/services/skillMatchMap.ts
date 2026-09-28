import { paiseToMajorUnits } from '../lib/format.ts'
import { asRecord, readBoolean, readNullableString, readNumber, readString } from '../lib/rows.ts'
import type { MatchingCatalogPerson } from '../matching/catalog.ts'
import type { MatchResult, SkillMatchDetail } from '../types.ts'

export type SkillMatchRpcRow = {
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
  matchedSkills: string[]
  missingCandidateSkills: string[]
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

function readStringList(row: Record<string, unknown>, key: string): string[] {
  const value = row[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function readNumeric(row: Record<string, unknown>, key: string): number | null {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function mapSkillMatchRpcRow(value: unknown): SkillMatchRpcRow | null {
  const row = asRecord(value)
  if (!row) return null
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const fullName = readString(row, 'full_name')
  const timezone = readString(row, 'timezone')
  if (!interviewerProfileId || !fullName || !timezone) return null

  const skillRatio = readNumeric(row, 'skill_ratio') ?? 0
  const skillPercent = readNumeric(row, 'skill_percent') ?? 0

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
    matchedSkills: readStringList(row, 'matched_skills'),
    missingCandidateSkills: readStringList(row, 'missing_candidate_skills'),
    extraInterviewerSkills: readStringList(row, 'extra_interviewer_skills'),
    skillRatio,
    skillPercent,
    ratingAvg: readNumeric(row, 'rating_avg'),
    reviewCount: readNumber(row, 'review_count') ?? 0,
    completedInterviewsCount: readNumber(row, 'completed_interviews_count') ?? 0,
    isOnline: readBoolean(row, 'is_online') ?? false,
    listPricePaise: readNumber(row, 'list_price_paise'),
    currency: readString(row, 'currency') ?? 'INR',
    isListed: readBoolean(row, 'is_listed') ?? false,
  }
}

/** Map RPC row into the existing matching catalog person shape (no services required). */
export function skillMatchRowToCatalogPerson(row: SkillMatchRpcRow): MatchingCatalogPerson {
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
    verification: {
      identity: false,
      employment: false,
      linkedin: false,
    },
    bio: row.bio ?? row.headline ?? '',
    previousCompanies: [],
    languages: row.languages,
    timezone: row.timezone,
    headline: row.headline,
  }
}

export function skillMatchRowToMatchResult(row: SkillMatchRpcRow): MatchResult {
  const skillMatch: SkillMatchDetail = {
    matchedSkills: row.matchedSkills,
    candidateMissingSkills: row.missingCandidateSkills,
    interviewerExtraSkills: row.extraInterviewerSkills,
    ratio: row.skillRatio,
    percent: row.skillPercent,
  }
  return {
    interviewerId: row.interviewerProfileId,
    score: Math.round(row.skillPercent),
    breakdown: {
      targetRole: 0,
      interviewType: 0,
      skills: row.skillRatio,
      candidateLevel: 0,
      availability: 0,
      company: 0,
      price: 0,
      quality: 0,
      language: 0,
    },
    reasons: [
      {
        key: 'skills',
        label: 'Skill overlap',
        matched: row.matchedSkills.length > 0,
      },
    ],
    skillMatch,
  }
}
