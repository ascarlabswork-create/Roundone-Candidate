import type { MatchingPreferences } from '../types.ts'
import { listPublicServicesFor } from '../services/interviewerPublic.ts'
import { resolveMatchingCandidateSkills } from './candidateSkills.ts'
import { applyPublicServices, type MatchingCatalogPerson } from './catalog.ts'
import type { MatchResult } from '../types.ts'
import type { BookingReadiness } from './bookingReadiness.ts'
import { describeBookingReadiness } from './liveAvailability.ts'
import { getOwnInterviewerProfileId } from '../services/ownInterviewer.ts'
import {
  matchInterviewersBySkills,
  skillMatchRowToCatalogPerson,
  skillMatchRowToMatchResult,
} from '../services/skillMatch.ts'

/** Top skill-compatible matches shown on Find → Matches. */
export const MATCHING_RESULT_LIMIT = 5

/** How many skill-ranked rows to availability-check before filling the result list. */
const MATCHING_AVAILABILITY_SCAN_LIMIT = 30

export type RecommendedMatch = {
  interviewer: MatchingCatalogPerson
  match: MatchResult
  /** Final candidate skill set used for this recommendation. */
  candidateSkills: string[]
  /** Always `ready` for returned matches — unbookable profiles are omitted. */
  booking: BookingReadiness
}

/**
 * Skill-ranked recommendations via match_interviewers_by_skills, then keep only
 * interviewers who currently have a bookable open slot (so Find → Matches never
 * offers a Book path that ends in an empty calendar).
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

  // Dual-persona safety net: never recommend the signed-in user's own interviewer profile.
  const ownInterviewerId = await getOwnInterviewerProfileId().catch(() => null)
  if (ownInterviewerId) {
    rows = rows.filter((row) => row.interviewerProfileId !== ownInterviewerId)
  }

  const scan = rows.slice(0, MATCHING_AVAILABILITY_SCAN_LIMIT)
  if (scan.length === 0) return []

  let services: Awaited<ReturnType<typeof listPublicServicesFor>> = []
  try {
    services = await listPublicServicesFor(scan.map((row) => row.interviewerProfileId))
  } catch (error) {
    console.error('match service lookup failed', error)
  }

  const recommended = scan.map((row) => {
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
    recommended.map(async (item) => {
      try {
        return await describeBookingReadiness(item.interviewer, prefs, displayTimezone)
      } catch (error) {
        console.error('booking readiness failed', item.interviewer.id, error)
        return 'no_availability' as BookingReadiness
      }
    }),
  )

  return recommended
    .map((item, index) => ({
      ...item,
      booking: booking[index] ?? 'no_availability',
    }))
    .filter((item) => item.booking === 'ready')
    .slice(0, MATCHING_RESULT_LIMIT)
}
