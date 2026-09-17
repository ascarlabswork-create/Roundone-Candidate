import { asRecord, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'
import { supabase } from '../lib/supabase.ts'
import {
  CANDIDATE_FEEDBACK_VIEW,
  FeedbackError,
  mapFeedbackError,
  parseCandidateSafeFeedback,
  type CandidateSafeFeedback,
} from './candidateFeedbackModel.ts'

export {
  CANDIDATE_FEEDBACK_VIEW,
  FeedbackError,
  READINESS_LABELS,
  READINESS_LEVELS,
  candidateFeedbackAction,
  mapFeedbackError,
  parseCandidateSafeFeedback,
  type CandidateSafeFeedback,
  type FeedbackErrorCode,
  type ReadinessLevel,
} from './candidateFeedbackModel.ts'

const FEEDBACK_SELECT = [
  'id',
  'booking_id',
  'interviewer_profile_id',
  'candidate_profile_id',
  'technical_skills',
  'problem_solving',
  'communication',
  'system_design',
  'coding',
  'behavioral',
  'overall',
  'strengths',
  'improvements',
  'summary',
  'readiness',
  'created_at',
].join(', ')

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new FeedbackError('unauthenticated', 'Please sign in to view your feedback.')
  }
  return data.user
}

export async function getCandidateFeedbackBookingIds(bookingIds: string[]): Promise<Set<string>> {
  const ids = new Set<string>()
  if (bookingIds.length === 0) return ids
  const { data, error } = await supabase
    .from(CANDIDATE_FEEDBACK_VIEW)
    .select('booking_id')
    .in('booking_id', bookingIds)
  if (error) {
    console.error('getCandidateFeedbackBookingIds failed', error)
    throw mapFeedbackError(error)
  }
  for (const row of data ?? []) {
    const parsed = asRecord(row)
    const bookingId = parsed ? readString(parsed, 'booking_id') : null
    if (bookingId) ids.add(bookingId)
  }
  return ids
}

export async function getCandidateSafeFeedback(bookingId: string): Promise<CandidateSafeFeedback | null> {
  await requireAuthenticatedUser()
  if (!isUuid(bookingId)) {
    throw new FeedbackError('unauthorized', 'You don’t have access to this feedback.')
  }

  const { data, error } = await supabase
    .from(CANDIDATE_FEEDBACK_VIEW)
    .select(FEEDBACK_SELECT)
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('getCandidateSafeFeedback failed', error)
    throw mapFeedbackError(error)
  }
  return parseCandidateSafeFeedback(data)
}
