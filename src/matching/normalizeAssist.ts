import { supabase } from '../lib/supabase.ts'
import { MATCHING_AI_FUNCTION, MATCHING_AI_TIMEOUT_MS } from './aiModel.ts'
import {
  NORMALIZATION_AI_MODE,
  hasNormalizableInput,
  hasUsableNormalization,
  isAlreadyCanonical,
  parseNormalizationAiResponse,
  toUsableNormalization,
  type MatchingVocabulary,
  type NormalizationInput,
  type UsableNormalization,
} from './normalizeModel.ts'
import { loadMatchingVocabulary } from './vocabulary.ts'

export type NormalizationAssistResult =
  | { ok: true; suggestions: UsableNormalization | null }
  | { ok: false }

const memoryCache = new Map<string, UsableNormalization | null>()

function vocabularySignature(vocabulary: MatchingVocabulary) {
  return [vocabulary.roles, vocabulary.skills, vocabulary.interviewTypes, vocabulary.candidateLevels, vocabulary.companies]
    .map((list) => `${list.length}:${list.slice(0, 2).join(',')}:${list.at(-1) ?? ''}`)
    .join('|')
}

function cacheKey(input: NormalizationInput, vocabulary: MatchingVocabulary) {
  return JSON.stringify({ input, vocab: vocabularySignature(vocabulary) })
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

function compactVocabulary(vocabulary: MatchingVocabulary): MatchingVocabulary {
  return {
    roles: vocabulary.roles.slice(0, 150),
    skills: vocabulary.skills.slice(0, 200),
    interviewTypes: vocabulary.interviewTypes.slice(0, 40),
    candidateLevels: vocabulary.candidateLevels.slice(0, 30),
    companies: vocabulary.companies.slice(0, 80),
  }
}

export async function requestNormalizationAssist(
  input: NormalizationInput,
): Promise<NormalizationAssistResult> {
  if (!hasNormalizableInput(input)) return { ok: true, suggestions: null }

  let vocabulary: MatchingVocabulary
  try {
    vocabulary = compactVocabulary(await loadMatchingVocabulary())
  } catch {
    return { ok: false }
  }

  if (isAlreadyCanonical(input, vocabulary)) return { ok: true, suggestions: null }

  const key = cacheKey(input, vocabulary)
  if (memoryCache.has(key)) return { ok: true, suggestions: memoryCache.get(key) ?? null }

  try {
    const invoke = supabase.functions.invoke(MATCHING_AI_FUNCTION, {
      body: {
        mode: NORMALIZATION_AI_MODE,
        input,
        vocabulary,
      },
    })
    const { data, error } = await withTimeout(invoke, MATCHING_AI_TIMEOUT_MS)
    if (error || data == null) {
      console.error('normalization assist failed')
      return { ok: false }
    }
    if (typeof data === 'object' && data && 'error' in data && !('skills' in data)) {
      return { ok: false }
    }
    const parsed = parseNormalizationAiResponse(data, vocabulary)
    if (!parsed) {
      console.error('normalization assist validation failed')
      return { ok: false }
    }
    const usable = toUsableNormalization(parsed, input)
    const suggestions = hasUsableNormalization(usable) ? usable : null
    memoryCache.set(key, suggestions)
    return { ok: true, suggestions }
  } catch (error) {
    console.error('normalization assist unavailable', error instanceof Error ? error.message : 'error')
    return { ok: false }
  }
}
