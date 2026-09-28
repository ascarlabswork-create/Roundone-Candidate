import { getCandidateSkills } from '../services/candidateProfile.ts'
import { getAcceptedResumeSkills } from '../services/resumeSkills.ts'
import { dedupeSkills } from './skills.ts'

/**
 * Final interview skill set for matching:
 * session/manual Find skills ∪ profile candidate_skills ∪ accepted resume skills.
 * Rejected / unreviewed resume skills are never loaded (getAcceptedResumeSkills).
 */
export async function resolveMatchingCandidateSkills(sessionSkills: string[]): Promise<string[]> {
  const parts = [...sessionSkills]
  try {
    const [profileSkills, acceptedResumeSkills] = await Promise.all([
      getCandidateSkills(),
      getAcceptedResumeSkills(),
    ])
    parts.push(...profileSkills, ...acceptedResumeSkills)
  } catch {
    // Not signed in or profile unavailable — use session skills only.
  }
  return dedupeSkills(parts)
}
