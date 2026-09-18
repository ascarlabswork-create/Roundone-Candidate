import {
  CANDIDATE_LEVELS,
  COMPANIES,
  INTERVIEW_TYPES,
  SKILLS,
  TARGET_ROLES,
} from '../data/catalogs.ts'
import { listPublicMatchingVocabulary } from '../services/interviewerPublic.ts'
import type { MatchingVocabulary } from './normalizeModel.ts'

const ROLE_LIMIT = 150
const SKILL_LIMIT = 200
const TYPE_LIMIT = 40
const LEVEL_LIMIT = 30
const COMPANY_LIMIT = 80

function mergeVocabulary(primary: string[], fallback: readonly string[], max: number) {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of [...primary, ...fallback]) {
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

export const CATALOG_MATCHING_VOCABULARY: MatchingVocabulary = {
  roles: [...TARGET_ROLES],
  skills: [...SKILLS],
  interviewTypes: [...INTERVIEW_TYPES],
  candidateLevels: [...CANDIDATE_LEVELS],
  companies: [...COMPANIES],
}

let cached: MatchingVocabulary | null = null
let inflight: Promise<MatchingVocabulary> | null = null

export async function loadMatchingVocabulary(): Promise<MatchingVocabulary> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = listPublicMatchingVocabulary()
    .then((live) => {
      const vocabulary: MatchingVocabulary = {
        roles: mergeVocabulary(live.roles, CATALOG_MATCHING_VOCABULARY.roles, ROLE_LIMIT),
        skills: mergeVocabulary(live.skills, CATALOG_MATCHING_VOCABULARY.skills, SKILL_LIMIT),
        interviewTypes: mergeVocabulary(
          live.interviewTypes,
          CATALOG_MATCHING_VOCABULARY.interviewTypes,
          TYPE_LIMIT,
        ),
        candidateLevels: mergeVocabulary(
          live.candidateLevels,
          CATALOG_MATCHING_VOCABULARY.candidateLevels,
          LEVEL_LIMIT,
        ),
        companies: mergeVocabulary(live.companies, CATALOG_MATCHING_VOCABULARY.companies, COMPANY_LIMIT),
      }
      cached = vocabulary
      return vocabulary
    })
    .catch((error) => {
      console.error('matching vocabulary unavailable', error)
      cached = CATALOG_MATCHING_VOCABULARY
      return CATALOG_MATCHING_VOCABULARY
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
