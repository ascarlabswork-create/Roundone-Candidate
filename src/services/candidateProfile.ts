import { supabase } from '../lib/supabase.ts'
import { requireUser } from './auth.ts'

export type ProfileRecord = {
  id: string
  role: 'candidate' | 'interviewer' | 'admin'
  full_name: string
  avatar_url: string | null
  timezone: string
  is_active: boolean
}

export type CandidateProfileRecord = {
  id: string
  profile_id: string
  headline: string | null
  bio: string | null
  target_role: string | null
  candidate_level: string | null
  target_company: string | null
  languages: string[]
}

export type CandidatePreferencesRecord = {
  candidate_profile_id: string
  interview_type: string | null
  skills: string[]
  preferred_date: string | null
  preferred_time_window: 'morning' | 'afternoon' | 'evening' | null
  budget_max_paise: number | null
  language: string | null
}

export type CandidateAccount = {
  userId: string
  email: string
  profile: ProfileRecord
  candidate: CandidateProfileRecord
}

export type CandidateProfileUpdates = {
  fullName?: string
  timezone?: string
  headline?: string | null
  bio?: string | null
  targetRole?: string | null
  candidateLevel?: string | null
  targetCompany?: string | null
  languages?: string[]
}

export type CandidatePreferencesUpdates = {
  interviewType?: string | null
  skills?: string[]
  preferredDate?: string | null
  preferredTimeWindow?: 'morning' | 'afternoon' | 'evening' | null
  budgetMaxPaise?: number | null
  language?: string | null
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getCandidateProfile(options?: { retries?: number }): Promise<CandidateAccount> {
  const user = await requireUser()
  const retries = options?.retries ?? 0
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, avatar_url, timezone, is_active')
      .eq('id', user.id)
      .maybeSingle()
    fail(profileError)

    if (!profile) {
      lastError = new Error('Your account profile is not ready yet. Try again in a moment.')
    } else if (profile.role !== 'candidate') {
      throw new Error('This Candidate app only supports candidate accounts.')
    } else {
      const { data: candidate, error: candidateError } = await supabase
        .from('candidate_profiles')
        .select(
          'id, profile_id, headline, bio, target_role, candidate_level, target_company, languages',
        )
        .eq('profile_id', user.id)
        .maybeSingle()
      fail(candidateError)

      if (candidate) {
        return {
          userId: user.id,
          email: user.email ?? '',
          profile,
          candidate,
        }
      }
      lastError = new Error('Your candidate profile is not ready yet. Try again in a moment.')
    }

    if (attempt < retries) await sleep(250 * (attempt + 1))
  }

  throw lastError ?? new Error('Could not load your candidate profile.')
}

export async function updateCandidateProfile(updates: CandidateProfileUpdates): Promise<CandidateAccount> {
  const account = await getCandidateProfile()
  const profilePatch: Record<string, string | null> = {}
  const candidatePatch: Record<string, string | string[] | null> = {}

  if (updates.fullName !== undefined) profilePatch.full_name = updates.fullName.trim()
  if (updates.timezone !== undefined) profilePatch.timezone = updates.timezone
  if (updates.headline !== undefined) candidatePatch.headline = updates.headline
  if (updates.bio !== undefined) candidatePatch.bio = updates.bio
  if (updates.targetRole !== undefined) candidatePatch.target_role = updates.targetRole
  if (updates.candidateLevel !== undefined) candidatePatch.candidate_level = updates.candidateLevel
  if (updates.targetCompany !== undefined) candidatePatch.target_company = updates.targetCompany
  if (updates.languages !== undefined) candidatePatch.languages = updates.languages

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await supabase.from('profiles').update(profilePatch).eq('id', account.userId)
    fail(error)
  }

  if (Object.keys(candidatePatch).length > 0) {
    const { error } = await supabase
      .from('candidate_profiles')
      .update(candidatePatch)
      .eq('id', account.candidate.id)
    fail(error)
  }

  return getCandidateProfile()
}

export async function getCandidatePreferences(): Promise<CandidatePreferencesRecord> {
  const account = await getCandidateProfile()
  const { data, error } = await supabase
    .from('candidate_preferences')
    .select(
      'candidate_profile_id, interview_type, skills, preferred_date, preferred_time_window, budget_max_paise, language',
    )
    .eq('candidate_profile_id', account.candidate.id)
    .maybeSingle()
  fail(error)

  if (data) return data

  const { data: created, error: insertError } = await supabase
    .from('candidate_preferences')
    .insert({ candidate_profile_id: account.candidate.id })
    .select(
      'candidate_profile_id, interview_type, skills, preferred_date, preferred_time_window, budget_max_paise, language',
    )
    .single()
  fail(insertError)
  if (!created) throw new Error('Could not create candidate preferences.')
  return created
}

export async function updateCandidatePreferences(
  updates: CandidatePreferencesUpdates,
): Promise<CandidatePreferencesRecord> {
  const current = await getCandidatePreferences()
  const patch: Record<string, string | string[] | number | null> = {}

  if (updates.interviewType !== undefined) patch.interview_type = updates.interviewType
  if (updates.skills !== undefined) patch.skills = updates.skills
  if (updates.preferredDate !== undefined) patch.preferred_date = updates.preferredDate
  if (updates.preferredTimeWindow !== undefined) patch.preferred_time_window = updates.preferredTimeWindow
  if (updates.budgetMaxPaise !== undefined) patch.budget_max_paise = updates.budgetMaxPaise
  if (updates.language !== undefined) patch.language = updates.language

  if (Object.keys(patch).length === 0) return current

  const { data, error } = await supabase
    .from('candidate_preferences')
    .update(patch)
    .eq('candidate_profile_id', current.candidate_profile_id)
    .select(
      'candidate_profile_id, interview_type, skills, preferred_date, preferred_time_window, budget_max_paise, language',
    )
    .single()
  fail(error)
  if (!data) throw new Error('Could not update candidate preferences.')
  return data
}

export async function getCandidateSkills(): Promise<string[]> {
  const account = await getCandidateProfile()
  const { data, error } = await supabase
    .from('candidate_skills')
    .select('skill')
    .eq('candidate_profile_id', account.candidate.id)
    .order('created_at', { ascending: true })
  fail(error)
  return (data ?? []).map((row) => row.skill)
}

export async function updateCandidateSkills(skills: string[]): Promise<string[]> {
  const account = await getCandidateProfile()
  const next = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))]

  const { data: existing, error: existingError } = await supabase
    .from('candidate_skills')
    .select('id, skill')
    .eq('candidate_profile_id', account.candidate.id)
  fail(existingError)

  const current = existing ?? []
  const toDelete = current.filter((row) => !next.includes(row.skill)).map((row) => row.id)
  const toInsert = next.filter((skill) => !current.some((row) => row.skill === skill))

  if (toDelete.length > 0) {
    const { error } = await supabase.from('candidate_skills').delete().in('id', toDelete)
    fail(error)
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('candidate_skills').insert(
      toInsert.map((skill) => ({
        candidate_profile_id: account.candidate.id,
        skill,
      })),
    )
    fail(error)
  }

  return getCandidateSkills()
}
