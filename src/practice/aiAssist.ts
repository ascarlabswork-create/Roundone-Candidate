import { supabase } from '../lib/supabase.ts'
import {
  PRACTICE_AI_FUNCTION,
  PRACTICE_FEEDBACK_TIMEOUT_MS,
  PRACTICE_QUESTION_TIMEOUT_MS,
  parsePracticeFeedback,
  parsePracticeQuestions,
  type PracticeAiFeedback,
  type PracticeAiQuestion,
  type PracticeSetup,
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
  return typeof data === 'object' && data != null && 'error' in data && !('questions' in data) && !('score' in data)
}

export async function requestPracticeQuestions(setup: PracticeSetup): Promise<PracticeAiQuestion[] | null> {
  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'practice_questions',
        setup: {
          targetRole: setup.targetRole.trim().slice(0, 80),
          interviewType: setup.interviewType.trim().slice(0, 60),
          skills: setup.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 6),
          difficulty: setup.difficulty,
          questionCount: setup.questionCount,
        },
      },
    })
    const { data, error } = await withTimeout(invoke, PRACTICE_QUESTION_TIMEOUT_MS)
    if (error || data == null || failedResult(data)) {
      console.error('practice questions failed')
      return null
    }
    return parsePracticeQuestions(data, setup)
  } catch (error) {
    console.error('practice questions unavailable', error instanceof Error ? error.message : 'error')
    return null
  }
}

export async function requestPracticeFeedback(
  question: PracticeAiQuestion,
  answer: string,
): Promise<PracticeAiFeedback | null> {
  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'practice_feedback',
        question: {
          question: question.question,
          topic: question.topic,
          difficulty: question.difficulty,
          expectedFocus: question.expectedFocus,
        },
        answer: answer.trim().slice(0, 4000),
      },
    })
    const { data, error } = await withTimeout(invoke, PRACTICE_FEEDBACK_TIMEOUT_MS)
    if (error || data == null || failedResult(data)) {
      console.error('practice feedback failed')
      return null
    }
    return parsePracticeFeedback(data)
  } catch (error) {
    console.error('practice feedback unavailable', error instanceof Error ? error.message : 'error')
    return null
  }
}
