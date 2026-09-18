import { supabase } from '../lib/supabase.ts'
import { asRecord, readBoolean, readNullableString, readNumber, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'

export const PUBLIC_DIRECTORY_SELECT =
  'interviewer_profile_id, full_name, avatar_url, headline, bio, current_role, company, experience_years, timezone, languages, list_price_paise, currency, is_online, rating_avg, review_count, completed_interviews_count, identity_verified, employment_verified, linkedin_verified'

export const PUBLIC_SERVICE_SELECT =
  'id, interviewer_profile_id, name, interview_type, duration_min, price_paise, currency, description'

export const MATCHING_CATALOG_LIMIT = 100

export type PublicInterviewer = {
  id: string
  name: string
  photo: string | null
  headline: string | null
  bio: string | null
  currentRole: string | null
  company: string | null
  experienceYears: number
  timezone: string
  languages: string[]
  listPricePaise: number | null
  currency: string
  isOnline: boolean
  ratingAvg: number | null
  reviewCount: number
  completedInterviews: number
  identityVerified: boolean
  employmentVerified: boolean
  linkedinVerified: boolean
}

export type PublicInterviewerSkill = {
  interviewerProfileId: string
  skill: string
}

export type PublicInterviewerRole = {
  interviewerProfileId: string
  targetRole: string
  candidateLevel: string
}

export type PublicInterviewerService = {
  id: string
  interviewerProfileId: string
  name: string
  interviewType: string
  durationMin: number
  pricePaise: number
  currency: string
  description: string | null
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function readStringList(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function mapPublicInterviewer(value: unknown): PublicInterviewer | null {
  const row = asRecord(value)
  if (!row) return null
  const id = readString(row, 'interviewer_profile_id')
  const name = readString(row, 'full_name')
  const timezone = readString(row, 'timezone')
  if (!id || !name || !timezone) return null
  return {
    id,
    name,
    photo: readNullableString(row, 'avatar_url'),
    headline: readNullableString(row, 'headline'),
    bio: readNullableString(row, 'bio'),
    currentRole: readNullableString(row, 'current_role'),
    company: readNullableString(row, 'company'),
    experienceYears: readNumber(row, 'experience_years') ?? 0,
    timezone,
    languages: readStringList(row, 'languages'),
    listPricePaise: readNumber(row, 'list_price_paise'),
    currency: readString(row, 'currency') ?? 'INR',
    isOnline: readBoolean(row, 'is_online') ?? false,
    ratingAvg: readNumber(row, 'rating_avg'),
    reviewCount: readNumber(row, 'review_count') ?? 0,
    completedInterviews: readNumber(row, 'completed_interviews_count') ?? 0,
    identityVerified: readBoolean(row, 'identity_verified') ?? false,
    employmentVerified: readBoolean(row, 'employment_verified') ?? false,
    linkedinVerified: readBoolean(row, 'linkedin_verified') ?? false,
  }
}

function mapPublicService(value: unknown): PublicInterviewerService | null {
  const row = asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const name = readString(row, 'name')
  const interviewType = readString(row, 'interview_type')
  const durationMin = readNumber(row, 'duration_min')
  const pricePaise = readNumber(row, 'price_paise')
  const currency = readString(row, 'currency')
  if (!id || !interviewerProfileId || !name || !interviewType || durationMin === null || pricePaise === null || !currency) {
    return null
  }
  return {
    id,
    interviewerProfileId,
    name,
    interviewType,
    durationMin,
    pricePaise,
    currency,
    description: readNullableString(row, 'description'),
  }
}

export async function getPublicInterviewer(interviewerProfileId: string): Promise<PublicInterviewer | null> {
  if (!isUuid(interviewerProfileId)) return null
  const { data, error } = await supabase
    .from('interviewer_public_directory')
    .select(PUBLIC_DIRECTORY_SELECT)
    .eq('interviewer_profile_id', interviewerProfileId)
    .maybeSingle()
  fail(error)
  return mapPublicInterviewer(data)
}

export async function getPublicInterviewerService(serviceId: string): Promise<PublicInterviewerService | null> {
  if (!isUuid(serviceId)) return null
  const { data, error } = await supabase
    .from('interviewer_services_public')
    .select(PUBLIC_SERVICE_SELECT)
    .eq('id', serviceId)
    .maybeSingle()
  fail(error)
  return mapPublicService(data)
}

export async function getPublicInterviewerServices(
  interviewerProfileId: string,
): Promise<PublicInterviewerService[]> {
  if (!isUuid(interviewerProfileId)) return []
  const { data, error } = await supabase
    .from('interviewer_services_public')
    .select(PUBLIC_SERVICE_SELECT)
    .eq('interviewer_profile_id', interviewerProfileId)
    .order('name', { ascending: true })
  fail(error)
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const mapped = mapPublicService(row)
    return mapped ? [mapped] : []
  })
}

export async function getPublicInterviewersByIds(ids: string[]): Promise<Map<string, PublicInterviewer>> {
  const result = new Map<string, PublicInterviewer>()
  const unique = [...new Set(ids.filter((id) => isUuid(id)))]
  if (unique.length === 0) return result
  const { data, error } = await supabase
    .from('interviewer_public_directory')
    .select(PUBLIC_DIRECTORY_SELECT)
    .in('interviewer_profile_id', unique)
  if (error) {
    console.error('getPublicInterviewersByIds failed', error)
    return result
  }
  for (const row of data ?? []) {
    const mapped = mapPublicInterviewer(row)
    if (mapped) result.set(mapped.id, mapped)
  }
  return result
}

export async function getPublicServicesByIds(ids: string[]): Promise<Map<string, PublicInterviewerService>> {
  const result = new Map<string, PublicInterviewerService>()
  const unique = [...new Set(ids.filter((id) => isUuid(id)))]
  if (unique.length === 0) return result
  const { data, error } = await supabase
    .from('interviewer_services_public')
    .select(PUBLIC_SERVICE_SELECT)
    .in('id', unique)
  if (error) {
    console.error('getPublicServicesByIds failed', error)
    return result
  }
  for (const row of data ?? []) {
    const mapped = mapPublicService(row)
    if (mapped) result.set(mapped.id, mapped)
  }
  return result
}

export async function getPublicBookingContext(interviewerProfileId: string): Promise<{
  interviewer: PublicInterviewer | null
  services: PublicInterviewerService[]
}> {
  if (!isUuid(interviewerProfileId)) {
    return { interviewer: null, services: [] }
  }
  const [interviewer, services] = await Promise.all([
    getPublicInterviewer(interviewerProfileId),
    getPublicInterviewerServices(interviewerProfileId),
  ])
  return { interviewer, services }
}

export async function listPublicDirectory(limit = MATCHING_CATALOG_LIMIT): Promise<PublicInterviewer[]> {
  const { data, error } = await supabase
    .from('interviewer_public_directory')
    .select(PUBLIC_DIRECTORY_SELECT)
    .limit(limit)
  fail(error)
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const mapped = mapPublicInterviewer(row)
    return mapped ? [mapped] : []
  })
}

export async function listPublicSkillsFor(ids: string[]): Promise<PublicInterviewerSkill[]> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))]
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('interviewer_skills_public')
    .select('interviewer_profile_id, skill')
    .in('interviewer_profile_id', unique)
  fail(error)
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const parsed = asRecord(row)
    const interviewerProfileId = parsed ? readString(parsed, 'interviewer_profile_id') : null
    const skill = parsed ? readString(parsed, 'skill') : null
    if (!interviewerProfileId || !skill) return []
    return [{ interviewerProfileId, skill }]
  })
}

export async function listPublicRolesFor(ids: string[]): Promise<PublicInterviewerRole[]> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))]
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('interviewer_roles_public')
    .select('interviewer_profile_id, target_role, candidate_level')
    .in('interviewer_profile_id', unique)
  fail(error)
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const parsed = asRecord(row)
    const interviewerProfileId = parsed ? readString(parsed, 'interviewer_profile_id') : null
    const targetRole = parsed ? readString(parsed, 'target_role') : null
    const candidateLevel = parsed ? readString(parsed, 'candidate_level') : null
    if (!interviewerProfileId || !targetRole || !candidateLevel) return []
    return [{ interviewerProfileId, targetRole, candidateLevel }]
  })
}

export async function listPublicServicesFor(ids: string[]): Promise<PublicInterviewerService[]> {
  const unique = [...new Set(ids.filter((id) => isUuid(id)))]
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('interviewer_services_public')
    .select(PUBLIC_SERVICE_SELECT)
    .in('interviewer_profile_id', unique)
  fail(error)
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const mapped = mapPublicService(row)
    return mapped ? [mapped] : []
  })
}

const VOCABULARY_ROW_LIMIT = 800

function uniqueVocabulary(values: string[], max: number) {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const text = value.trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= max) break
  }
  return result
}

export type PublicMatchingVocabulary = {
  roles: string[]
  skills: string[]
  interviewTypes: string[]
  candidateLevels: string[]
  companies: string[]
}

export async function listPublicMatchingVocabulary(): Promise<PublicMatchingVocabulary> {
  const empty: PublicMatchingVocabulary = {
    roles: [],
    skills: [],
    interviewTypes: [],
    candidateLevels: [],
    companies: [],
  }
  try {
    const [rolesResult, skillsResult, servicesResult, directoryResult] = await Promise.all([
      supabase.from('interviewer_roles_public').select('target_role, candidate_level').limit(VOCABULARY_ROW_LIMIT),
      supabase.from('interviewer_skills_public').select('skill').limit(VOCABULARY_ROW_LIMIT),
      supabase.from('interviewer_services_public').select('interview_type').limit(VOCABULARY_ROW_LIMIT),
      supabase.from('interviewer_public_directory').select('company').limit(VOCABULARY_ROW_LIMIT),
    ])
    if (rolesResult.error) console.error('listPublicMatchingVocabulary roles failed', rolesResult.error)
    if (skillsResult.error) console.error('listPublicMatchingVocabulary skills failed', skillsResult.error)
    if (servicesResult.error) console.error('listPublicMatchingVocabulary services failed', servicesResult.error)
    if (directoryResult.error) console.error('listPublicMatchingVocabulary companies failed', directoryResult.error)

    const roles: string[] = []
    const candidateLevels: string[] = []
    for (const row of rolesResult.data ?? []) {
      const parsed = asRecord(row)
      const role = parsed ? readString(parsed, 'target_role') : null
      const level = parsed ? readString(parsed, 'candidate_level') : null
      if (role) roles.push(role)
      if (level) candidateLevels.push(level)
    }

    const skills: string[] = []
    for (const row of skillsResult.data ?? []) {
      const parsed = asRecord(row)
      const skill = parsed ? readString(parsed, 'skill') : null
      if (skill) skills.push(skill)
    }

    const interviewTypes: string[] = []
    for (const row of servicesResult.data ?? []) {
      const parsed = asRecord(row)
      const interviewType = parsed ? readString(parsed, 'interview_type') : null
      if (interviewType) interviewTypes.push(interviewType)
    }

    const companies: string[] = []
    for (const row of directoryResult.data ?? []) {
      const parsed = asRecord(row)
      const company = parsed ? readString(parsed, 'company') : null
      if (company) companies.push(company)
    }

    return {
      roles: uniqueVocabulary(roles, 150),
      skills: uniqueVocabulary(skills, 200),
      interviewTypes: uniqueVocabulary(interviewTypes, 40),
      candidateLevels: uniqueVocabulary(candidateLevels, 30),
      companies: uniqueVocabulary(companies, 80),
    }
  } catch (error) {
    console.error('listPublicMatchingVocabulary failed', error)
    return empty
  }
}
