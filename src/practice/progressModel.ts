import { asRecord, readNumber, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'
import { isPracticeDifficulty, isPracticeQuestionType, type PracticeDifficulty, type PracticeQuestionType } from './aiModel.ts'
import type { SavedPracticeSession } from './session.ts'

/** Stored AI practice scores use the same 1–10 scale as live practice feedback. */
export const PRACTICE_SCORE_MIN = 1
export const PRACTICE_SCORE_MAX = 10
export const PRACTICE_HISTORY_LIMIT = 30

export const PRACTICE_SESSIONS_TABLE = 'practice_sessions'
export const PRACTICE_QUESTIONS_TABLE = 'practice_questions'
export const PRACTICE_ANSWERS_TABLE = 'practice_answers'
export const SAVE_PRACTICE_SESSION_RPC = 'save_completed_practice_session'
export const GET_PRACTICE_PROGRESS_RPC = 'get_practice_progress'

export type PracticeErrorCode = 'unauthenticated' | 'not_found' | 'network' | 'rpc' | 'validation'

export class PracticeError extends Error {
  readonly code: PracticeErrorCode

  constructor(code: PracticeErrorCode, message: string) {
    super(message)
    this.name = 'PracticeError'
    this.code = code
  }
}

export type PracticeSessionSummary = {
  id: string
  targetRole: string
  interviewType: string
  difficulty: PracticeDifficulty
  topics: string[]
  questionCount: number
  questionsAnswered: number
  averageScore: number | null
  status: 'completed'
  completedAt: string
}

export type PracticeQuestionResult = {
  id: string
  sortIndex: number
  question: string
  questionType: PracticeQuestionType
  topic: string
  difficulty: PracticeDifficulty
  expectedFocus: string[]
  answer: {
    answerText: string
    score: number
    strengths: string[]
    improvements: string[]
    missingPoints: string[]
    summary: string
  } | null
}

export type PracticeSessionDetail = PracticeSessionSummary & {
  questions: PracticeQuestionResult[]
}

/** Deterministic unique themes from stored answers in one session (no AI). */
export function uniqueStoredThemes(
  questions: PracticeQuestionResult[],
  key: 'strengths' | 'improvements' | 'missingPoints',
  max = 6,
) {
  const result: string[] = []
  for (const question of questions) {
    const values = question.answer?.[key] ?? []
    for (const value of values) {
      if (result.some((existing) => existing.toLowerCase() === value.toLowerCase())) continue
      result.push(value)
      if (result.length >= max) return result
    }
  }
  return result
}

export type PracticeTrendPoint = {
  id: string
  completedAt: string
  averageScore: number
}

export type PracticeProgressSummary = {
  sessionCount: number
  questionsAnswered: number
  averageScore: number | null
  highestScore: number | null
  latest: PracticeSessionSummary | null
  trend: PracticeTrendPoint[]
  strengths: string[]
  topicsToReview: string[]
}

function readStringArray(value: unknown, maxItems: number, maxLen: number) {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const text = item.trim().slice(0, maxLen)
    if (!text) continue
    if (result.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue
    result.push(text)
    if (result.length >= maxItems) break
  }
  return result
}

function readDifficulty(value: unknown): PracticeDifficulty | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isPracticeDifficulty(normalized) ? normalized : null
}

function readScore(value: unknown) {
  const score = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(score)) return null
  if (score < PRACTICE_SCORE_MIN || score > PRACTICE_SCORE_MAX) return null
  return Math.round(score * 10) / 10
}

export function formatPracticeScore(score: number | null) {
  if (score == null) return '—'
  const rounded = Math.round(score * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text} / 10`
}

export function formatPracticeDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatPracticeDateShort(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export function difficultyLabel(value: PracticeDifficulty) {
  if (value === 'beginner') return 'Beginner'
  if (value === 'advanced') return 'Advanced'
  return 'Intermediate'
}

export function practiceAgainHref(session: Pick<PracticeSessionSummary, 'targetRole' | 'interviewType' | 'difficulty' | 'topics'>) {
  const params = new URLSearchParams({
    again: '1',
    role: session.targetRole,
    type: session.interviewType,
    difficulty: session.difficulty,
  })
  if (session.topics.length > 0) params.set('skills', session.topics.join(','))
  return `/candidate/practice/mock?${params.toString()}`
}

export function mapPracticeError(error: unknown, fallback: string) {
  if (error instanceof PracticeError) return error
  const message = error instanceof Error ? error.message : ''
  const lower = message.toLowerCase()
  if (lower.includes('not_authenticated') || lower.includes('jwt')) {
    return new PracticeError('unauthenticated', 'Please sign in to view your AI practice progress.')
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return new PracticeError('network', 'Unable to load AI practice progress. Check your connection.')
  }
  console.error('practice progress failed', error)
  return new PracticeError('rpc', fallback)
}

export function parsePracticeSessionSummary(value: unknown): PracticeSessionSummary | null {
  const row = asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const targetRole = readString(row, 'target_role') ?? readString(row, 'targetRole')
  const interviewType = readString(row, 'interview_type') ?? readString(row, 'interviewType')
  const difficulty = readDifficulty(row.difficulty)
  const completedAt = readString(row, 'completed_at') ?? readString(row, 'completedAt')
  const questionCount = readNumber(row, 'question_count') ?? readNumber(row, 'questionCount')
  const questionsAnswered = readNumber(row, 'questions_answered') ?? readNumber(row, 'questionsAnswered') ?? 0
  if (!id || !isUuid(id) || !targetRole || !interviewType || !difficulty || !completedAt || questionCount == null) {
    return null
  }
  const status = readString(row, 'status')
  if (status && status !== 'completed') return null
  return {
    id,
    targetRole: targetRole.slice(0, 80),
    interviewType: interviewType.slice(0, 60),
    difficulty,
    topics: readStringArray(row.topics, 6, 40),
    questionCount,
    questionsAnswered,
    averageScore: readScore(row.average_score ?? row.averageScore),
    status: 'completed',
    completedAt,
  }
}

function parseStoredAnswer(value: unknown): PracticeQuestionResult['answer'] {
  const rows = Array.isArray(value) ? value : value ? [value] : []
  const row = asRecord(rows[0])
  if (!row) return null
  const answerText = readString(row, 'answer_text') ?? readString(row, 'answerText')
  const score = readScore(row.score)
  const summary = readString(row, 'summary')
  if (!answerText || score == null || !summary) return null
  return {
    answerText,
    score,
    strengths: readStringArray(row.strengths, 5, 140),
    improvements: readStringArray(row.improvements, 5, 140),
    missingPoints: readStringArray(row.missing_points ?? row.missingPoints, 5, 140),
    summary,
  }
}

export function parsePracticeQuestionResult(value: unknown, index: number): PracticeQuestionResult | null {
  const row = asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const question = readString(row, 'question_text') ?? readString(row, 'question')
  if (!id || !isUuid(id) || !question) return null
  const questionTypeRaw = (readString(row, 'question_type') ?? readString(row, 'questionType') ?? 'technical').toLowerCase()
  const difficulty = readDifficulty(row.difficulty) ?? 'intermediate'
  const topic = readString(row, 'topic') ?? ''
  return {
    id,
    sortIndex: readNumber(row, 'sort_index') ?? readNumber(row, 'sortIndex') ?? index,
    question,
    questionType: isPracticeQuestionType(questionTypeRaw) ? questionTypeRaw : 'technical',
    topic,
    difficulty,
    expectedFocus: readStringArray(row.expected_focus ?? row.expectedFocus, 5, 80),
    answer: parseStoredAnswer(row.practice_answers ?? row.answer),
  }
}

export function parsePracticeProgress(value: unknown): PracticeProgressSummary | null {
  const row = asRecord(value)
  if (!row) return null
  const sessionCount = readNumber(row, 'session_count') ?? readNumber(row, 'sessionCount')
  const questionsAnswered = readNumber(row, 'questions_answered') ?? readNumber(row, 'questionsAnswered')
  if (sessionCount == null || questionsAnswered == null) return null
  const trendRaw = Array.isArray(row.trend) ? row.trend : []
  const trend: PracticeTrendPoint[] = []
  for (const item of trendRaw) {
    const parsed = asRecord(item)
    if (!parsed) continue
    const id = readString(parsed, 'id')
    const completedAt = readString(parsed, 'completed_at') ?? readString(parsed, 'completedAt')
    const averageScore = readScore(parsed.average_score ?? parsed.averageScore)
    if (!id || !isUuid(id) || !completedAt || averageScore == null) continue
    trend.push({ id, completedAt, averageScore })
  }
  return {
    sessionCount,
    questionsAnswered,
    averageScore: readScore(row.average_score ?? row.averageScore),
    highestScore: readScore(row.highest_score ?? row.highestScore),
    latest: parsePracticeSessionSummary(row.latest),
    trend,
    strengths: readStringArray(row.strengths, 6, 140),
    topicsToReview: readStringArray(row.topics_to_review ?? row.topicsToReview, 6, 140),
  }
}

export function buildCompletedPracticePayload(session: SavedPracticeSession) {
  return {
    target_role: session.setup.targetRole.trim().slice(0, 80),
    interview_type: session.setup.interviewType.trim().slice(0, 60),
    difficulty: session.setup.difficulty,
    topics: session.setup.skills.slice(0, 6),
    question_count: session.questions.length,
    questions: session.questions.map((question) => {
      const turn = session.turns.find((item) => item.question.id === question.id)
      return {
        question: question.question,
        question_type: question.questionType,
        topic: question.topic,
        difficulty: question.difficulty,
        expected_focus: question.expectedFocus,
        answer: turn?.feedback
          ? {
              answer_text: turn.answer,
              score: turn.feedback.score,
              strengths: turn.feedback.strengths,
              improvements: turn.feedback.improvements,
              missing_points: turn.feedback.missingPoints,
              summary: turn.feedback.summary,
            }
          : null,
      }
    }),
  }
}
