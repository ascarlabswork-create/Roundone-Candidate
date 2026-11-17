import { getCandidateSkills } from '../services/candidateProfile.ts'
import { getAcceptedResumeSkills } from '../services/resumeSkills.ts'
import { dedupeSkills } from './skills.ts'

/**
 * Skills used for Find → Matches (and browse scoring).
 *
 * When the user listed skills for this search, match only against those.
 * Merging the full profile/resume dump used to return weak overlaps
 * ("3% Skill Match" on 1 of 31 skills) that felt unrelated.
 *
 * When the search skill list is empty, fall back to profile ∪ accepted resume skills.
 */
export async function resolveMatchingCandidateSkills(sessionSkills: string[]): Promise<string[]> {
  const session = dedupeSkills(sessionSkills)
  if (session.length > 0) return session

  const parts: string[] = []
  try {
    const [profileSkills, acceptedResumeSkills] = await Promise.all([
      getCandidateSkills(),
      getAcceptedResumeSkills(),
    ])
    parts.push(...profileSkills, ...acceptedResumeSkills)
  } catch {
    // Not signed in or profile unavailable — no fallback skills.
  }
  return dedupeSkills(parts)
}
