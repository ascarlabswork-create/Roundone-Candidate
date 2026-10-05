import type { MatchingPreferences } from '../types.ts'
import { listPublicServicesFor } from '../services/interviewerPublic.ts'
import { resolveMatchingCandidateSkills } from './candidateSkills.ts'
import { applyPublicServices, type MatchingCatalogPerson } from './catalog.ts'
import type { MatchResult } from '../types.ts'
import type { BookingReadiness } from './bookingReadiness.ts'
import { describeBookingReadiness } from './liveAvailability.ts'
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
  /** Separate from the skill score. Missing service or slots does not remove the match. */
  booking: BookingReadiness
}

/**
 * Skill-only recommendations via secure match_interviewers_by_skills RPC.
 * Does not use is_listed, availability, services, or other non-skill factors.
 */
export async function recommendMatchedInterviewers(
  prefs: MatchingPreferences,
  displayTimezone?: string | null,
): Promise<RecommendedMatch[]> {
  const candidateSkills = await resolveMatchingCandidateSkills(prefs.skills)
  if (candidateSkills.length === 0) return []

  let rows
  try {
    rows = await matchInterviewersBySkills(candidateSkills)
  } catch (error) {
    console.error('skill match RPC failed', error)
    throw new Error('Unable to load interviewers. Please try again.')
  }

  const limited = rows.slice(0, MATCHING_RESULT_LIMIT)
  let services: Awaited<ReturnType<typeof listPublicServicesFor>> = []
  try {
    services = await listPublicServicesFor(limited.map((row) => row.interviewerProfileId))
  } catch (error) {
    console.error('match service lookup failed', error)
  }

  const recommended = limited.map((row) => {
    const interviewer = applyPublicServices(
      skillMatchRowToCatalogPerson(row),
      services.filter((service) => service.interviewerProfileId === row.interviewerProfileId),
    )
    return {
      interviewer,
      match: skillMatchRowToMatchResult(row),
      candidateSkills,
    }
  })

  const booking = await Promise.all(
    recommended.map((item) => describeBookingReadiness(item.interviewer, prefs, displayTimezone)),
  )

  return recommended.map((item, index) => ({
    ...item,
    booking: booking[index] ?? 'no_service',
  }))
}
