import { asRecord, readNumber, readString } from '../lib/rows.ts'
import { BookingError } from './bookingModel.ts'

export const CANDIDATE_FEEDBACK_VIEW = 'interviewer_feedback_for_candidate'

export const READINESS_LEVELS = ['ready', 'almost_ready', 'needs_more_practice'] as const
export type ReadinessLevel = (typeof READINESS_LEVELS)[number]

export const READINESS_LABELS: Record<ReadinessLevel, string> = {
  ready: 'Ready',
  almost_ready: 'Almost Ready',
  needs_more_practice: 'Needs More Practice',
}

export type FeedbackErrorCode = 'unauthenticated' | 'unauthorized' | 'network' | 'rpc'

export class FeedbackError extends Error {
  readonly code: FeedbackErrorCode

  constructor(code: FeedbackErrorCode, message: string) {
    super(message)
    this.name = 'FeedbackError'
    this.code = code
  }
}

/** Candidate-safe scorecard. Does not include interviewer internal_notes. */
export type CandidateSafeFeedback = {
  id: string
  bookingId: string
  interviewerProfileId: string
  candidateProfileId: string
  technicalSkills: number
  problemSolving: number
  communication: number
  systemDesign: number | null
  coding: number | null
  behavioral: number | null
  overall: number
  strengths: string[]
  improvements: string[]
  summary: string
  readiness: ReadinessLevel
  createdAt: string
}

function isReadinessLevel(value: string): value is ReadinessLevel {
  return (READINESS_LEVELS as readonly string[]).includes(value)
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function errorText(error: unknown) {
  if (!error || typeof error !== 'object') return typeof error === 'string' ? error.toLowerCase() : ''
  const record = error as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  const details = typeof record.details === 'string' ? record.details : ''
  const code = typeof record.code === 'string' ? record.code : ''
  return `${code} ${message} ${details}`.toLowerCase()
}

function isNetworkFailure(error: unknown) {
  if (error instanceof TypeError) return true
  const text = errorText(error)
  const message = error instanceof Error ? error.message : ''
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(`${text} ${message}`)
}

export function mapFeedbackError(error: unknown): FeedbackError {
  if (error instanceof FeedbackError) return error
  if (error instanceof BookingError) {
    if (error.code === 'unauthenticated') {
      return new FeedbackError('unauthenticated', 'Please sign in to view your feedback.')
    }
    if (error.code === 'not_found') {
      return new FeedbackError('unauthorized', 'You don’t have access to this feedback.')
    }
    if (error.code === 'network') {
      return new FeedbackError('network', 'Could not connect. Check your internet connection and try again.')
    }
  }
  if (isNetworkFailure(error)) {
    return new FeedbackError('network', 'Could not connect. Check your internet connection and try again.')
  }
  const text = errorText(error)
  if (
    text.includes('not_authenticated') ||
    text.includes('auth session missing') ||
    text.includes('jwt')
  ) {
    return new FeedbackError('unauthenticated', 'Please sign in to view your feedback.')
  }
  if (
    text.includes('not_authorized') ||
    text.includes('42501') ||
    text.includes('permission denied') ||
    text.includes('row-level security')
  ) {
    return new FeedbackError('unauthorized', 'You don’t have access to this feedback.')
  }
  return new FeedbackError('rpc', 'Unable to load this feedback. Please try again.')
}

export function candidateFeedbackAction(
  status: string,
  hasFeedback: boolean,
): 'view' | 'pending' | null {
  if (status !== 'completed') return null
  return hasFeedback ? 'view' : 'pending'
}

export function parseCandidateSafeFeedback(value: unknown): CandidateSafeFeedback | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const bookingId = readString(row, 'booking_id')
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const candidateProfileId = readString(row, 'candidate_profile_id')
  const technicalSkills = readNumber(row, 'technical_skills')
  const problemSolving = readNumber(row, 'problem_solving')
  const communication = readNumber(row, 'communication')
  const overall = readNumber(row, 'overall')
  const summary = readString(row, 'summary')
  const readiness = readString(row, 'readiness')
  const createdAt = readString(row, 'created_at')
  if (
    !id ||
    !bookingId ||
    !interviewerProfileId ||
    !candidateProfileId ||
    technicalSkills === null ||
    problemSolving === null ||
    communication === null ||
    overall === null ||
    summary === null ||
    !readiness ||
    !isReadinessLevel(readiness) ||
    !createdAt
  ) {
    return null
  }
  return {
    id,
    bookingId,
    interviewerProfileId,
    candidateProfileId,
    technicalSkills,
    problemSolving,
    communication,
    systemDesign: readNumber(row, 'system_design'),
    coding: readNumber(row, 'coding'),
    behavioral: readNumber(row, 'behavioral'),
    overall,
    strengths: readStringArray(row.strengths),
    improvements: readStringArray(row.improvements),
    summary,
    readiness,
    createdAt,
  }
}
