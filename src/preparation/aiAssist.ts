import { supabase } from '../lib/supabase.ts'
import {
  PREPARATION_AI_FUNCTION,
  PREPARATION_AI_MODE,
  PREPARATION_TIMEOUT_MS,
  parsePreparationResult,
  type PreparationInput,
  type PreparationResult,
} from './aiModel.ts'

const memoryCache = new Map<string, PreparationResult>()

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

function failedResult(data: unknown) {
  return typeof data === 'object' && data != null && 'error' in data && !('profile_summary' in data) && !('profileSummary' in data)
}

export async function requestPreparationAssist(
  input: PreparationInput,
  cacheKey: string,
): Promise<PreparationResult | null> {
  const cached = memoryCache.get(cacheKey)
  if (cached) return cached

  try {
    const invoke = supabase.functions.invoke(PREPARATION_AI_FUNCTION, {
      body: {
        mode: PREPARATION_AI_MODE,
        input: {
          targetRole: input.targetRole.trim().slice(0, 80),
          experienceLevel: input.experienceLevel.trim().slice(0, 40),
          skills: input.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 12),
          interviewType: input.interviewType.trim().slice(0, 60),
          resumeText: input.resumeText.trim().slice(0, 8000),
        },
      },
    })
    const { data, error } = await withTimeout(invoke, PREPARATION_TIMEOUT_MS)
    if (error || data == null || failedResult(data)) {
      console.error('preparation assist failed')
      return null
    }
    const parsed = parsePreparationResult(data)
    if (!parsed) {
      console.error('preparation assist validation failed')
      return null
    }
    memoryCache.set(cacheKey, parsed)
    return parsed
  } catch (error) {
    console.error('preparation assist unavailable', error instanceof Error ? error.message : 'error')
    return null
  }
}
