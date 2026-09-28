import type { Interviewer, MatchingPreferences, MatchResult } from '../types.ts'
import { requestMatchingAssist } from './aiAssist.ts'
import {
  MATCHING_AI_CANDIDATE_LIMIT,
  combineMatchScore,
  mergeNormalizedPreferences,
  toAiCandidate,
  toAiPreferences,
  type MatchingAiMatch,
} from './aiModel.ts'
import { flagInterviewersWithBookableSlots } from './liveAvailability.ts'
import { loadMatchingCatalog, type MatchingCatalogPerson } from './catalog.ts'
import { constrainNormalizedToVocabulary } from './normalizeModel.ts'
import { rankInterviewers } from './score.ts'
import { loadMatchingVocabulary } from './vocabulary.ts'

/** Top skill-compatible matches shown on Find → Matches (availability is annotated, not a hard gate). */
export const MATCHING_RESULT_LIMIT = 5

export type RecommendedMatch = {
  interviewer: MatchingCatalogPerson
  match: MatchResult
  ai: MatchingAiMatch | null
  /** Live bookable slot in the next window (and preferred dates if set). Not used to hide the card. */
  hasBookableSlot: boolean
}

function bestAiForInterviewer(person: Interviewer, byService: Map<string, MatchingAiMatch>) {
  let best: MatchingAiMatch | null = null
  for (const service of person.services) {
    const hit = byService.get(service.id)
    if (!hit) continue
    if (!best || hit.relevanceScore > best.relevanceScore) best = hit
  }
  return best
}

export async function recommendMatchedInterviewers(prefs: MatchingPreferences): Promise<RecommendedMatch[]> {
  let catalog: MatchingCatalogPerson[]
  try {
    catalog = await loadMatchingCatalog()
  } catch (error) {
    console.error('matching catalog failed', error)
    throw new Error('Unable to load interviewers. Please try again.')
  }
  if (catalog.length === 0) return []

  // Rank the full catalog by compatibility first — do not drop skill matches for missing slots.
  const initialRank = rankInterviewers(catalog, prefs)
  const byId = new Map(catalog.map((person) => [person.id, person]))
  const top = initialRank
    .slice(0, MATCHING_AI_CANDIDATE_LIMIT)
    .flatMap((item) => {
      const person = byId.get(item.interviewerId)
      return person ? [person] : []
    })

  const assist =
    top.length === 0 ? null : await requestMatchingAssist(toAiPreferences(prefs), top.map(toAiCandidate))
  const grounded = assist?.normalized
    ? constrainNormalizedToVocabulary(assist.normalized, await loadMatchingVocabulary())
    : null
  const mergedPrefs = mergeNormalizedPreferences(prefs, grounded)
  const ranked = mergedPrefs === prefs ? initialRank : rankInterviewers(catalog, mergedPrefs)
  const aiByService = new Map((assist?.matches ?? []).map((item) => [item.serviceId, item]))

  const displayRank = ranked.slice(0, MATCHING_RESULT_LIMIT)
  const displayPeople = displayRank.flatMap((match) => {
    const person = byId.get(match.interviewerId)
    return person ? [person] : []
  })
  const bookableFlags = await flagInterviewersWithBookableSlots(displayPeople, prefs)

  return displayRank.flatMap((match) => {
    const interviewer = byId.get(match.interviewerId)
    if (!interviewer) return []
    const ai = bestAiForInterviewer(interviewer, aiByService)
    return [
      {
        interviewer,
        match: {
          ...match,
          score: combineMatchScore(match.score, ai?.relevanceScore ?? null),
        },
        ai,
        hasBookableSlot: bookableFlags.get(interviewer.id) === true,
      },
    ]
  })
}
