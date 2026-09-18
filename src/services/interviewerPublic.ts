import { supabase } from '../lib/supabase.ts'
import { asRecord, readBoolean, readNullableString, readNumber, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'

export type PublicInterviewer = {
  id: string
  name: string
  photo: string | null
  headline: string | null
  currentRole: string | null
  company: string | null
  timezone: string
  identityVerified: boolean
  employmentVerified: boolean
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
    currentRole: readNullableString(row, 'current_role'),
    company: readNullableString(row, 'company'),
    timezone,
    identityVerified: readBoolean(row, 'identity_verified') ?? false,
    employmentVerified: readBoolean(row, 'employment_verified') ?? false,
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
    .select(
      'interviewer_profile_id, full_name, avatar_url, headline, current_role, company, timezone, identity_verified, employment_verified',
    )
    .eq('interviewer_profile_id', interviewerProfileId)
    .maybeSingle()
  fail(error)
  return mapPublicInterviewer(data)
}

export async function getPublicInterviewerService(serviceId: string): Promise<PublicInterviewerService | null> {
  if (!isUuid(serviceId)) return null
  const { data, error } = await supabase
    .from('interviewer_services_public')
    .select(
      'id, interviewer_profile_id, name, interview_type, duration_min, price_paise, currency, description',
    )
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
    .select(
      'id, interviewer_profile_id, name, interview_type, duration_min, price_paise, currency, description',
    )
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
    .select(
      'interviewer_profile_id, full_name, avatar_url, headline, current_role, company, timezone, identity_verified, employment_verified',
    )
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
    .select(
      'id, interviewer_profile_id, name, interview_type, duration_min, price_paise, currency, description',
    )
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
