import { supabase } from '../lib/supabase.ts'
import {
  MATCHING_AI_FUNCTION,
  MATCHING_AI_TIMEOUT_MS,
  allowedFactorPool,
  parseMatchingAiResponse,
  type MatchingAiCandidateInput,
  type MatchingAiPreferences,
  type MatchingAiRequest,
  type MatchingAiResponse,
} from './aiModel.ts'

const memoryCache = new Map<string, MatchingAiResponse>()

function cacheKey(request: MatchingAiRequest) {
  return JSON.stringify({
    preferences: request.preferences,
    ids: request.candidates.flatMap((person) => person.services.map((service) => service.id)),
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function requestMatchingAssist(
  preferences: MatchingAiPreferences,
  candidates: MatchingAiCandidateInput[],
): Promise<MatchingAiResponse | null> {
  const request: MatchingAiRequest = { preferences, candidates }
  const key = cacheKey(request)
  const cached = memoryCache.get(key)
  if (cached) return cached

  try {
    const invoke = supabase.functions.invoke(MATCHING_AI_FUNCTION, { body: request })
    const { data, error } = await withTimeout(invoke, MATCHING_AI_TIMEOUT_MS)
    if (error || data == null) {
      console.error('matching assist failed')
      return null
    }
    if (typeof data === 'object' && data && 'error' in data && !('matches' in data)) {
      return null
    }
    const allowedServiceIds = new Set(candidates.flatMap((person) => person.services.map((service) => service.id)))
    const parsed = parseMatchingAiResponse(data, allowedServiceIds, allowedFactorPool(preferences, candidates))
    if (!parsed) {
      console.error('matching assist validation failed')
      return null
    }
    memoryCache.set(key, parsed)
    return parsed
  } catch (error) {
    console.error('matching assist unavailable', error instanceof Error ? error.message : 'error')
    return null
  }
}
