import { asRecord, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'
import { supabase } from '../lib/supabase.ts'
import {
  CANDIDATE_REVIEWS_PUBLIC_VIEW,
  CANDIDATE_REVIEWS_TABLE,
  mapReviewError,
  parseCandidateReview,
  parsePublicCandidateReview,
  SUBMIT_CANDIDATE_REVIEW_RPC,
  validateReviewInput,
  ReviewError,
  type CandidateReviewRecord,
  type SubmitCandidateReviewInput,
} from './candidateReviewModel.ts'

export {
  CANDIDATE_REVIEWS_PUBLIC_VIEW,
  CANDIDATE_REVIEWS_TABLE,
  REVIEW_ALREADY_SUBMITTED,
  REVIEW_DIMENSIONS,
  REVIEW_INVALID_RATING,
  REVIEW_MISSING_FIELDS,
  REVIEW_NETWORK_ERROR,
  REVIEW_NOT_COMPLETED,
  REVIEW_UNAUTHORIZED,
  RECOMMEND_LABELS,
  RECOMMEND_LEVELS,
  SUBMIT_CANDIDATE_REVIEW_RPC,
  candidateReviewAction,
  mapReviewError,
  parseCandidateReview,
  parsePublicCandidateReview,
  validateReviewInput,
  ReviewError,
  type CandidateReviewRecord,
  type ModerationStatus,
  type RecommendLevel,
  type ReviewDimensionKey,
  type SubmitCandidateReviewInput,
} from './candidateReviewModel.ts'

const OWN_REVIEW_SELECT = [
  'id',
  'booking_id',
  'interviewer_profile_id',
  'candidate_profile_id',
  'overall_rating',
  'technical_expertise',
  'communication',
  'interview_realism',
  'feedback_quality',
  'professionalism',
  'recommend',
  'written_review',
  'show_name_publicly',
  'display_name',
  'moderation_status',
  'created_at',
].join(', ')

const PUBLIC_REVIEW_SELECT = [
  'id',
  'interviewer_profile_id',
  'display_name',
  'overall_rating',
  'technical_expertise',
  'communication',
  'interview_realism',
  'feedback_quality',
  'professionalism',
  'recommend',
  'written_review',
  'created_at',
].join(', ')

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new ReviewError('unauthenticated', 'Please sign in to review this interviewer.')
  }
  return data.user
}

export async function getCandidateReviewBookingIds(bookingIds: string[]): Promise<Set<string>> {
  const ids = new Set<string>()
  if (bookingIds.length === 0) return ids
  const { data, error } = await supabase
    .from(CANDIDATE_REVIEWS_TABLE)
    .select('booking_id')
    .in('booking_id', bookingIds)
  if (error) {
    console.error('getCandidateReviewBookingIds failed', error)
    throw mapReviewError(error, 'load')
  }
  for (const row of data ?? []) {
    const parsed = asRecord(row)
    const bookingId = parsed ? readString(parsed, 'booking_id') : null
    if (bookingId) ids.add(bookingId)
  }
  return ids
}

export async function getMyReviewForBooking(bookingId: string): Promise<CandidateReviewRecord | null> {
  await requireAuthenticatedUser()
  if (!isUuid(bookingId)) {
    throw new ReviewError('unauthorized', 'You can only review interviewers from your own completed interviews.')
  }

  const { data, error } = await supabase
    .from(CANDIDATE_REVIEWS_TABLE)
    .select(OWN_REVIEW_SELECT)
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('getMyReviewForBooking failed', error)
    throw mapReviewError(error, 'load')
  }
  return parseCandidateReview(data)
}

export async function getPublicCandidateReviews(interviewerProfileId: string) {
  if (!isUuid(interviewerProfileId)) return []
  const { data, error } = await supabase
    .from(CANDIDATE_REVIEWS_PUBLIC_VIEW)
    .select(PUBLIC_REVIEW_SELECT)
    .eq('interviewer_profile_id', interviewerProfileId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getPublicCandidateReviews failed', error)
    throw mapReviewError(error, 'load')
  }
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const parsed = parsePublicCandidateReview(row)
    return parsed ? [parsed] : []
  })
}

export async function submitCandidateReview(input: SubmitCandidateReviewInput): Promise<CandidateReviewRecord> {
  await requireAuthenticatedUser()
  const invalid = validateReviewInput(input)
  if (invalid) throw new ReviewError('invalid', invalid)
  if (!isUuid(input.bookingId)) {
    throw new ReviewError('unauthorized', 'You can only review interviewers from your own completed interviews.')
  }

  try {
    const { data, error } = await supabase.rpc(SUBMIT_CANDIDATE_REVIEW_RPC, {
      p_booking_id: input.bookingId,
      p_overall_rating: input.overallRating,
      p_technical_expertise: input.technicalExpertise,
      p_communication: input.communication,
      p_interview_realism: input.interviewRealism,
      p_feedback_quality: input.feedbackQuality,
      p_professionalism: input.professionalism,
      p_recommend: input.recommend,
      p_written_review: input.writtenReview.trim(),
      p_show_name_publicly: input.showNamePublicly,
    })
    if (error) throw mapReviewError(error)
    const saved = parseCandidateReview(data)
    if (!saved) throw new ReviewError('rpc', 'Could not submit your review. Please try again.')
    return saved
  } catch (caught) {
    if (caught instanceof ReviewError) throw caught
    throw mapReviewError(caught)
  }
}
