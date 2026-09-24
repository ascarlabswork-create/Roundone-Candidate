import { supabase } from '../lib/supabase.ts'
import {
  PRACTICE_AI_FUNCTION,
  PRACTICE_FEEDBACK_TIMEOUT_MS,
  PRACTICE_QUESTION_TIMEOUT_MS,
  parsePracticeFeedback,
  parsePracticeNextQuestion,
  parsePracticeQuestions,
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
    !('score' in data)
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

export async function requestPracticeQuestions(setup: PracticeSetup): Promise<PracticeAiQuestion[] | null> {
  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'practice_questions',
        setup: setupBody(setup),
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
  priorTurns: PracticePriorTurn[],
): Promise<PracticeAiQuestion | null> {
  try {
    const invoke = supabase.functions.invoke(PRACTICE_AI_FUNCTION, {
      body: {
        mode: 'practice_next_question',
        setup: setupBody(setup),
        question_number: questionNumber,
        prior_turns: priorTurns.map((turn) => ({
          question: turn.question.slice(0, 600),
          topic: turn.topic.slice(0, 40),
          score: turn.score,
          missing_points: turn.missingPoints.slice(0, 5),
        })),
      },
    })
    const { data, error } = await withTimeout(invoke, PRACTICE_QUESTION_TIMEOUT_MS)
    if (error || data == null || failedResult(data)) {
      console.error('practice next question failed')
      return null
    }
    return parsePracticeNextQuestion(
      data,
      setup,
      questionNumber,
      priorTurns.map((turn) => turn.question),
    )
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
