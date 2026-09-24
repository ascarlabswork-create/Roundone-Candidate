import { supabase } from '../lib/supabase.ts'
import type { CandidateContext, AdaptiveState, StructuredInterviewContext } from './contextEngine.ts'
import {
  PRACTICE_AI_FUNCTION,
  PRACTICE_FEEDBACK_TIMEOUT_MS,
  PRACTICE_QUESTION_TIMEOUT_MS,
  parsePracticeFeedback,
  parsePracticeNextQuestion,
  parsePracticeQuestions,
  pickRandomFocusDimension,
  type PracticeAiFeedback,
  type PracticeAiQuestion,
  type PracticePriorTurn,
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
  return (
    typeof data === 'object' &&
    data != null &&
    'error' in data &&
    !('questions' in data) &&
    !('question' in data) &&
    !('score' in data) &&
    !('client_secret' in data) &&
    !('audio_base64' in data)
  )
}

function setupBody(setup: PracticeSetup) {
  return {
    targetRole: setup.targetRole.trim().slice(0, 80),
    interviewType: setup.interviewType.trim().slice(0, 60),
    skills: setup.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 6),
    difficulty: setup.difficulty,
    questionCount: setup.questionCount,
  }
}

export async function requestRealtimeSession(
  setup: PracticeSetup,
  voice?: string,
  interviewerName?: string,
): Promise<string | null> {
  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'realtime_session',
        setup: setupBody(setup),
        voice: voice || 'echo',
        interviewerName: interviewerName || 'John',
      },
    })
    const { data, error } = await withTimeout(invoke, 8_000)
    if (error || data == null || failedResult(data)) {
      return null
    }
    const secret = (data as Record<string, unknown>).client_secret
    return typeof secret === 'string' && secret ? secret : null
  } catch {
    return null
  }
}

export async function requestSpeechAudio(text: string, voice?: string): Promise<string | null> {
  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'tts',
        text: text.trim().slice(0, 600),
        voice: voice || 'echo',
      },
    })
    const { data, error } = await withTimeout(invoke, 10_000)
    if (error || data == null || failedResult(data)) {
      return null
    }
    const base64 = (data as Record<string, unknown>).audio_base64
    return typeof base64 === 'string' && base64 ? base64 : null
  } catch {
    return null
  }
}

export async function requestPracticeQuestions(
  setup: PracticeSetup,
  excludeQuestions?: string[],
): Promise<PracticeAiQuestion[] | null> {
  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'practice_questions',
        setup: setupBody(setup),
        exclude_questions: (excludeQuestions ?? []).slice(0, 40),
        session_seed: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

export async function requestNextPracticeQuestion(
  setup: PracticeSetup,
  questionNumber: number,
  priorTurns: (PracticePriorTurn & { answer?: string })[],
  context?: {
    candidate?: CandidateContext
    state?: AdaptiveState
    structured?: StructuredInterviewContext
    interviewerName?: string
    excludeQuestions?: string[]
    focusDimension?: string
    sessionSeed?: string
  },
): Promise<PracticeAiQuestion | null> {
  const banList = [
    ...priorTurns.map((turn) => turn.question),
    ...(context?.excludeQuestions ?? []),
  ]
  const focusDimension = context?.focusDimension || pickRandomFocusDimension()
  const sessionSeed = context?.sessionSeed || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'practice_next_question',
        setup: setupBody(setup),
        interviewerName: context?.interviewerName || 'John',
        question_number: questionNumber,
        prior_turns: priorTurns.map((turn) => ({
          question: turn.question.slice(0, 600),
          topic: turn.topic.slice(0, 40),
          answer: turn.answer ? turn.answer.slice(0, 1000) : undefined,
          score: turn.score,
          missing_points: turn.missingPoints.slice(0, 5),
        })),
        candidate_context: context?.candidate ?? context?.structured?.candidate,
        adaptive_state: context?.state ?? context?.structured?.state,
        exclude_questions: banList.slice(0, 40),
        focus_dimension: focusDimension,
        session_seed: sessionSeed,
      },
    })
    const { data, error } = await withTimeout(invoke, PRACTICE_QUESTION_TIMEOUT_MS)
    if (error || data == null || failedResult(data)) {
      console.error('practice next question failed')
      return null
    }

    let question = parsePracticeNextQuestion(
      data,
      setup,
      questionNumber,
      banList,
    )

    // If duplicate check rejected it, retry once with an alternate scenario focus and fresh seed
    if (!question) {
      const alternateDimension = pickRandomFocusDimension([focusDimension])
      const retryInvoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
        body: {
          mode: 'practice_next_question',
          setup: setupBody(setup),
          interviewerName: context?.interviewerName || 'John',
          question_number: questionNumber,
          prior_turns: priorTurns.map((turn) => ({
            question: turn.question.slice(0, 600),
            topic: turn.topic.slice(0, 40),
            answer: turn.answer ? turn.answer.slice(0, 1000) : undefined,
            score: turn.score,
            missing_points: turn.missingPoints.slice(0, 5),
          })),
          candidate_context: context?.candidate ?? context?.structured?.candidate,
          adaptive_state: context?.state ?? context?.structured?.state,
          exclude_questions: banList.slice(0, 40),
          focus_dimension: alternateDimension,
          session_seed: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        },
      })
      const { data: retryData, error: retryError } = await withTimeout(retryInvoke, PRACTICE_QUESTION_TIMEOUT_MS)
      if (!retryError && retryData && !failedResult(retryData)) {
        question = parsePracticeNextQuestion(
          retryData,
          setup,
          questionNumber,
          banList,
        )
      }
    }

    return question
  } catch (error) {
    console.error('practice next question unavailable', error instanceof Error ? error.message : 'error')
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
