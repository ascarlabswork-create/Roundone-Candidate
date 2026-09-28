import type { MatchingPreferences } from '../types.ts'
import { resolveMatchingCandidateSkills } from './candidateSkills.ts'
import type { MatchingCatalogPerson } from './catalog.ts'
import type { MatchResult } from '../types.ts'
import {
  matchInterviewersBySkills,
  skillMatchRowToCatalogPerson,
  skillMatchRowToMatchResult,
} from '../services/skillMatch.ts'

/** Top skill-compatible matches shown on Find → Matches. */
export const MATCHING_RESULT_LIMIT = 5

export type RecommendedMatch = {
  interviewer: MatchingCatalogPerson
  match: MatchResult
  /** Final candidate skill set used for this recommendation. */
  candidateSkills: string[]
}

/**
 * Skill-only recommendations via secure match_interviewers_by_skills RPC.
 * Does not use is_listed, availability, services, or other non-skill factors.
 */
export async function recommendMatchedInterviewers(prefs: MatchingPreferences): Promise<RecommendedMatch[]> {
  const candidateSkills = await resolveMatchingCandidateSkills(prefs.skills)
  if (candidateSkills.length === 0) return []

  let rows
  try {
    rows = await matchInterviewersBySkills(candidateSkills)
  } catch (error) {
    console.error('skill match RPC failed', error)
    throw new Error('Unable to load interviewers. Please try again.')
  }

  return rows.slice(0, MATCHING_RESULT_LIMIT).map((row) => ({
    interviewer: skillMatchRowToCatalogPerson(row),
    match: skillMatchRowToMatchResult(row),
    candidateSkills,
  }))
}
