import { supabase } from '../lib/supabase.ts'
import {
  RESUME_AI_FUNCTION,
  RESUME_AI_MODE,
  RESUME_AI_TIMEOUT_MS,
  RESUME_TEXT_MAX,
  parseResumeSkillPlan,
  type ResumeSkillPlan,
} from './aiModel.ts'

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
  return (
    typeof data === 'object' &&
    data != null &&
    'error' in data &&
    !('extracted_skills' in data) &&
    !('extractedSkills' in data)
  )
}

export type ResumeSkillPlanOutcome =
  | { ok: true; plan: ResumeSkillPlan }
  | { ok: false; reason: 'insufficient_evidence' | 'unavailable' }

/**
 * Analyze a candidate resume and return a strictly resume-grounded interview
 * skill plan. Nothing is invented: the secure edge function only returns skills,
 * projects, experiences and certifications anchored in the resume text.
 */
export async function requestResumeSkillPlan(resumeText: string): Promise<ResumeSkillPlanOutcome> {
  try {
    const invoke = supabase.functions.invoke(RESUME_AI_FUNCTION, {
      body: {
        mode: RESUME_AI_MODE,
        resume_text: resumeText.trim().slice(0, RESUME_TEXT_MAX),
      },
    })
    const { data, error } = await withTimeout(invoke, RESUME_AI_TIMEOUT_MS)
    if (error || data == null) {
      return { ok: false, reason: 'unavailable' }
    }
    if (failedResult(data)) {
      const reason =
        typeof data === 'object' && data != null && (data as Record<string, unknown>).error === 'insufficient_resume_evidence'
          ? 'insufficient_evidence'
          : 'unavailable'
      return { ok: false, reason }
    }
    const plan = parseResumeSkillPlan(data)
    if (!plan) {
      return { ok: false, reason: 'insufficient_evidence' }
    }
    return { ok: true, plan }
  } catch (err) {
    console.error('resume skill plan unavailable', err instanceof Error ? err.message : 'error')
    return { ok: false, reason: 'unavailable' }
  }
}
