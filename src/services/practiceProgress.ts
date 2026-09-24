import { asRecord, readString } from '../lib/rows.ts'
import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  FAIL_PRACTICE_SESSION_RPC,
  GET_PRACTICE_PROGRESS_RPC,
  PRACTICE_ANSWERS_TABLE,
  PRACTICE_HISTORY_LIMIT,
  PRACTICE_QUESTIONS_TABLE,
  PRACTICE_SESSIONS_TABLE,
  PracticeError,
  SAVE_PRACTICE_SESSION_RPC,
  SAVE_PRACTICE_TURN_RPC,
  START_PRACTICE_SESSION_RPC,
  buildCompletedPracticePayload,
  buildPracticeTurnPayload,
  buildStartPracticePayload,
  mapPracticeError,
  parsePracticeProgress,
  parsePracticeQuestionResult,
  parsePracticeSessionSummary,
  type PracticeProgressSummary,
  type PracticeSessionDetail,
  type PracticeSessionSummary,
} from '../practice/progressModel.ts'
import type { PracticeSetup, PracticeTurn } from '../practice/aiModel.ts'
import type { SavedPracticeSession } from '../practice/session.ts'

export {
  PRACTICE_HISTORY_LIMIT,
  PracticeError,
  difficultyLabel,
  formatPracticeDate,
  formatPracticeDateShort,
  formatPracticeScore,
  practiceAgainHref,
  uniqueStoredThemes,
  type PracticeProgressSummary,
  type PracticeQuestionResult,
  type PracticeSessionDetail,
  type PracticeSessionSummary,
  type PracticeTrendPoint,
} from '../practice/progressModel.ts'

const SESSION_LIST_SELECT = [
  'id',
  'target_role',
  'interview_type',
  'difficulty',
  'topics',
  'question_count',
  'questions_answered',
  'average_score',
  'status',
  'completed_at',
].join(', ')

const QUESTION_DETAIL_SELECT = [
  'id',
  'sort_index',
  'question_text',
  'question_type',
  'topic',
  'difficulty',
  'expected_focus',
].join(', ')

const ANSWER_DETAIL_SELECT = [
  'practice_question_id',
  'answer_text',
  'score',
  'strengths',
  'improvements',
  'missing_points',
  'summary',
].join(', ')

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new PracticeError('unauthenticated', 'Please sign in to view your AI practice progress.')
  }
  return data.user
}

export async function startPracticeSession(setup: PracticeSetup): Promise<string> {
  await requireAuthenticatedUser()
  const { data, error } = await supabase.rpc(START_PRACTICE_SESSION_RPC, {
    p_payload: buildStartPracticePayload(setup),
  })
  if (error) {
    throw mapPracticeError(error, 'Unable to start this AI interview. Please try again.')
  }
  if (typeof data !== 'string' || !isUuid(data)) {
    throw new PracticeError('rpc', 'Unable to start this AI interview. Please try again.')
  }
  return data
}

export async function savePracticeTurn(
  sessionId: string,
  sortIndex: number,
  turn: PracticeTurn,
): Promise<{ completed: boolean; questionsAnswered: number }> {
  await requireAuthenticatedUser()
  if (!isUuid(sessionId)) {
    throw new PracticeError('not_found', "You don't have access to this practice session.")
  }
  const { data, error } = await supabase.rpc(SAVE_PRACTICE_TURN_RPC, {
    p_session_id: sessionId,
    p_payload: buildPracticeTurnPayload(sortIndex, turn),
  })
  if (error) {
    throw mapPracticeError(error, 'Unable to save this practice answer. Please try again.')
  }
  const row = asRecord(data)
  return {
    completed: Boolean(row?.completed),
    questionsAnswered: typeof row?.questions_answered === 'number' ? row.questions_answered : sortIndex + 1,
  }
}

export async function failPracticeSession(sessionId: string): Promise<void> {
  if (!isUuid(sessionId)) return
  try {
    await requireAuthenticatedUser()
    await supabase.rpc(FAIL_PRACTICE_SESSION_RPC, { p_session_id: sessionId })
  } catch {
    // Best-effort; failed AI generation must not mark completed.
  }
}

export async function saveCompletedPracticeSession(session: SavedPracticeSession): Promise<string> {
  await requireAuthenticatedUser()
  if (session.questions.length < 1) {
    throw new PracticeError('validation', 'This practice session has no questions to save.')
  }

  const { data, error } = await supabase.rpc(SAVE_PRACTICE_SESSION_RPC, {
    p_payload: buildCompletedPracticePayload(session),
  })

  if (error) {
    throw mapPracticeError(error, 'Unable to save this practice session. Please try again.')
  }
  if (typeof data !== 'string' || !isUuid(data)) {
    throw new PracticeError('rpc', 'Unable to save this practice session. Please try again.')
  }
  return data
}

export async function listPracticeSessions(): Promise<PracticeSessionSummary[]> {
  await requireAuthenticatedUser()
  const { data, error } = await supabase
    .from(PRACTICE_SESSIONS_TABLE)
    .select(SESSION_LIST_SELECT)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(PRACTICE_HISTORY_LIMIT)

  if (error) {
    throw mapPracticeError(error, 'Unable to load your practice history. Please try again.')
  }

  const sessions: PracticeSessionSummary[] = []
  for (const row of data ?? []) {
    const parsed = parsePracticeSessionSummary(row)
    if (parsed) sessions.push(parsed)
  }
  return sessions
}

export async function fetchRecentPracticeQuestionTexts(limit = 60): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const sessions = await listPracticeSessions()
    if (sessions.length === 0) return []
    const sessionIds = sessions.slice(0, 10).map((s) => s.id)
    const { data, error } = await supabase
      .from(PRACTICE_QUESTIONS_TABLE)
      .select('question_text')
      .in('practice_session_id', sessionIds)
      .limit(limit)
    if (error || !Array.isArray(data)) return []
    return data
      .map((r) => (typeof r.question_text === 'string' ? r.question_text.trim() : ''))
      .filter((q) => q.length >= 15)
  } catch {
    return []
  }
}

export async function getPracticeSessionDetail(sessionId: string): Promise<PracticeSessionDetail | null> {
  await requireAuthenticatedUser()
  if (!isUuid(sessionId)) {
    throw new PracticeError('not_found', "You don't have access to this practice session.")
  }

  const [{ data: sessionRow, error: sessionError }, { data: questionRows, error: questionError }] = await Promise.all([
    supabase.from(PRACTICE_SESSIONS_TABLE).select(SESSION_LIST_SELECT).eq('id', sessionId).maybeSingle(),
    supabase
      .from(PRACTICE_QUESTIONS_TABLE)
      .select(QUESTION_DETAIL_SELECT)
      .eq('practice_session_id', sessionId)
      .order('sort_index', { ascending: true }),
  ])

  if (sessionError) {
    throw mapPracticeError(sessionError, 'Unable to load this practice session. Please try again.')
  }
  if (questionError) {
    throw mapPracticeError(questionError, 'Unable to load this practice session. Please try again.')
  }

  const session = parsePracticeSessionSummary(sessionRow)
  if (!session) return null

  const questionIds = (questionRows ?? [])
    .map((row) => {
      const parsed = parsePracticeQuestionResult(row, 0)
      return parsed?.id
    })
    .filter((id): id is string => Boolean(id))

  const answerMap = new Map<string, unknown>()
  if (questionIds.length > 0) {
    const { data: answerRows, error: answerError } = await supabase
      .from(PRACTICE_ANSWERS_TABLE)
      .select(ANSWER_DETAIL_SELECT)
      .in('practice_question_id', questionIds)
    if (answerError) {
      throw mapPracticeError(answerError, 'Unable to load this practice session. Please try again.')
    }
    for (const row of answerRows ?? []) {
      const parsed = asRecord(row)
      const questionId = parsed ? readString(parsed, 'practice_question_id') : null
      if (parsed && questionId) answerMap.set(questionId, parsed)
    }
  }

  return {
    ...session,
    questions: (questionRows ?? [])
      .map((row, index) => {
        const parsed = asRecord(row)
        if (!parsed) return null
        const questionId = readString(parsed, 'id')
        return parsePracticeQuestionResult(
          { ...parsed, practice_answers: questionId ? answerMap.get(questionId) ?? null : null },
          index,
        )
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => a.sortIndex - b.sortIndex),
  }
}

export async function getPracticeProgress(): Promise<PracticeProgressSummary> {
  await requireAuthenticatedUser()
  const { data, error } = await supabase.rpc(GET_PRACTICE_PROGRESS_RPC)
  if (error) {
    throw mapPracticeError(error, 'Unable to load your practice progress. Please try again.')
  }
  const parsed = parsePracticeProgress(data)
  if (!parsed) {
    throw new PracticeError('rpc', 'Unable to load your practice progress. Please try again.')
  }
  return parsed
}
