import type { MatchingPreferences, MatchResult } from '../types.ts'
import { resolveMatchingCandidateSkills } from './candidateSkills.ts'
import { loadMatchingCatalog, type MatchingCatalogPerson } from './catalog.ts'
import { rankInterviewers } from './score.ts'

/** Top skill-compatible matches shown on Find → Matches. */
export const MATCHING_RESULT_LIMIT = 5

export type RecommendedMatch = {
  interviewer: MatchingCatalogPerson
  match: MatchResult
  /** Final candidate skill set used for this recommendation. */
  candidateSkills: string[]
}

/**
 * Skill-only recommendations: rank public interviewers by skill overlap and return top 5.
 * Availability, services, role, price, and AI assist are not used for inclusion or ranking.
 */
export async function recommendMatchedInterviewers(prefs: MatchingPreferences): Promise<RecommendedMatch[]> {
  const candidateSkills = await resolveMatchingCandidateSkills(prefs.skills)
  if (candidateSkills.length === 0) return []

  let catalog: MatchingCatalogPerson[]
  try {
    catalog = await loadMatchingCatalog()
  } catch (error) {
    console.error('matching catalog failed', error)
    throw new Error('Unable to load interviewers. Please try again.')
  }
  if (catalog.length === 0) return []

  const skillPrefs: MatchingPreferences = { ...prefs, skills: candidateSkills }
  const ranked = rankInterviewers(catalog, skillPrefs)
  const byId = new Map(catalog.map((person) => [person.id, person]))

  // Only interviewers with at least one overlapping skill appear in results.
  const withOverlap = ranked.filter((match) => match.skillMatch.matchedSkills.length > 0)

  return withOverlap.slice(0, MATCHING_RESULT_LIMIT).flatMap((match) => {
    const interviewer = byId.get(match.interviewerId)
    if (!interviewer) return []
    return [{ interviewer, match, candidateSkills }]
  })
}
