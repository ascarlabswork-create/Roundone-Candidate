import { asRecord, readBoolean, readNumber, readString } from '../lib/rows.ts'
import { BookingError } from './bookingModel.ts'

export const CANDIDATE_REVIEWS_TABLE = 'candidate_reviews'
export const CANDIDATE_REVIEWS_PUBLIC_VIEW = 'candidate_reviews_public'
export const SUBMIT_CANDIDATE_REVIEW_RPC = 'submit_candidate_review'

export const RECOMMEND_LEVELS = ['yes', 'maybe', 'no'] as const
export type RecommendLevel = (typeof RECOMMEND_LEVELS)[number]

export const RECOMMEND_LABELS: Record<RecommendLevel, string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
}

export const MODERATION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

export const REVIEW_DIMENSIONS = [
  { key: 'technicalExpertise', label: 'Technical Expertise' },
  { key: 'communication', label: 'Communication' },
  { key: 'interviewRealism', label: 'Interview Realism' },
  { key: 'feedbackQuality', label: 'Feedback Quality' },
  { key: 'professionalism', label: 'Professionalism' },
] as const

export type ReviewDimensionKey = (typeof REVIEW_DIMENSIONS)[number]['key']

export const REVIEW_ALREADY_SUBMITTED = 'You have already submitted a review for this interview.'
export const REVIEW_NOT_COMPLETED = 'You can review an interviewer after the interview is completed.'
export const REVIEW_UNAUTHORIZED = 'You can only review interviewers from your own completed interviews.'
export const REVIEW_INVALID_RATING = 'Ratings must be between 1 and 5.'
export const REVIEW_MISSING_FIELDS = 'Please complete all required fields.'
export const REVIEW_GENERIC_ERROR = 'Could not submit your review. Please try again.'
export const REVIEW_NETWORK_ERROR = 'Could not connect. Check your internet connection and try again.'
export const REVIEW_LOAD_ERROR = 'Unable to load this review. Please try again.'

export type ReviewErrorCode = 'unauthenticated' | 'unauthorized' | 'not_completed' | 'duplicate' | 'invalid' | 'network' | 'rpc'

export class ReviewError extends Error {
  readonly code: ReviewErrorCode

  constructor(code: ReviewErrorCode, message: string) {
    super(message)
    this.name = 'ReviewError'
    this.code = code
  }
}

export type CandidateReviewRecord = {
  id: string
  bookingId: string
  interviewerProfileId: string
  candidateProfileId: string
  overallRating: number
  technicalExpertise: number
  communication: number
  interviewRealism: number
  feedbackQuality: number
  professionalism: number
  recommend: RecommendLevel
  writtenReview: string
  showNamePublicly: boolean
  displayName: string
  moderationStatus: ModerationStatus
  createdAt: string
}

export type SubmitCandidateReviewInput = {
  bookingId: string
  overallRating: number
  technicalExpertise: number
  communication: number
  interviewRealism: number
  feedbackQuality: number
  professionalism: number
  recommend: RecommendLevel
  writtenReview: string
  showNamePublicly: boolean
}

function isRecommendLevel(value: string): value is RecommendLevel {
  return (RECOMMEND_LEVELS as readonly string[]).includes(value)
}

function isModerationStatus(value: string): value is ModerationStatus {
  return (MODERATION_STATUSES as readonly string[]).includes(value)
}

export function isReviewRating(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

export function candidateReviewAction(status: string, alreadySubmitted: boolean): 'rate' | 'submitted' | null {
  if (status !== 'completed') return null
  return alreadySubmitted ? 'submitted' : 'rate'
}

function errorText(error: unknown) {
  if (!error || typeof error !== 'object') return typeof error === 'string' ? error.toLowerCase() : ''
  const record = error as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  const details = typeof record.details === 'string' ? record.details : ''
  const hint = typeof record.hint === 'string' ? record.hint : ''
  const code = typeof record.code === 'string' ? record.code : ''
  return `${code} ${message} ${details} ${hint}`.toLowerCase()
}

function isNetworkFailure(error: unknown) {
  if (error instanceof TypeError) return true
  const text = errorText(error)
  const message = error instanceof Error ? error.message : ''
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(`${text} ${message}`)
}

export function mapReviewError(error: unknown, kind: 'load' | 'submit' = 'submit'): ReviewError {
  if (error instanceof ReviewError) return error
  if (error instanceof BookingError) {
    if (error.code === 'unauthenticated') {
      return new ReviewError('unauthenticated', 'Please sign in to review this interviewer.')
    }
    if (error.code === 'not_found') {
      return new ReviewError('unauthorized', REVIEW_UNAUTHORIZED)
    }
    if (error.code === 'network') {
      return new ReviewError('network', REVIEW_NETWORK_ERROR)
    }
  }
  if (isNetworkFailure(error)) {
    return new ReviewError('network', REVIEW_NETWORK_ERROR)
  }
  const text = errorText(error)
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : null
  const code = record && typeof record.code === 'string' ? record.code : ''
  if (text.includes('not_authenticated') || text.includes('auth session missing') || text.includes('jwt')) {
    return new ReviewError('unauthenticated', 'Please sign in to review this interviewer.')
  }
  if (text.includes('not_authorized') || code === '42501' || text.includes('permission denied')) {
    return new ReviewError('unauthorized', REVIEW_UNAUTHORIZED)
  }
  if (text.includes('booking_not_found') || code === 'P0002') {
    return new ReviewError('unauthorized', REVIEW_UNAUTHORIZED)
  }
  if (
    code === '23505' ||
    code === '409' ||
    text.includes('candidate_reviews_booking_id') ||
    text.includes('duplicate key') ||
    text.includes('already exists')
  ) {
    return new ReviewError('duplicate', REVIEW_ALREADY_SUBMITTED)
  }
  if (text.includes('invalid_status') || code === 'P0001') {
    return new ReviewError('not_completed', REVIEW_NOT_COMPLETED)
  }
  if (code === '23514' || text.includes('candidate_reviews_scores_chk') || text.includes('scores_chk')) {
    return new ReviewError('invalid', REVIEW_INVALID_RATING)
  }
  if (code === '23502' || text.includes('null value') || text.includes('not-null')) {
    return new ReviewError('invalid', REVIEW_MISSING_FIELDS)
  }
  return new ReviewError('rpc', kind === 'load' ? REVIEW_LOAD_ERROR : REVIEW_GENERIC_ERROR)
}

export function validateReviewInput(input: SubmitCandidateReviewInput) {
  if (
    !isReviewRating(input.overallRating) ||
    !isReviewRating(input.technicalExpertise) ||
    !isReviewRating(input.communication) ||
    !isReviewRating(input.interviewRealism) ||
    !isReviewRating(input.feedbackQuality) ||
    !isReviewRating(input.professionalism)
  ) {
    return 'Please rate the interviewer from 1 to 5 in every category.'
  }
  if (!isRecommendLevel(input.recommend)) return 'Please say whether you would recommend this interviewer.'
  if (!input.writtenReview.trim()) return 'Please write a short review of this interviewer.'
  return null
}

export function parseCandidateReview(value: unknown): CandidateReviewRecord | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const bookingId = readString(row, 'booking_id')
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const candidateProfileId = readString(row, 'candidate_profile_id')
  const overallRating = readNumber(row, 'overall_rating')
  const technicalExpertise = readNumber(row, 'technical_expertise')
  const communication = readNumber(row, 'communication')
  const interviewRealism = readNumber(row, 'interview_realism')
  const feedbackQuality = readNumber(row, 'feedback_quality')
  const professionalism = readNumber(row, 'professionalism')
  const recommend = readString(row, 'recommend')
  const writtenReview = readString(row, 'written_review')
  const displayName = readString(row, 'display_name')
  const moderationStatus = readString(row, 'moderation_status')
  const createdAt = readString(row, 'created_at')
  if (
    !id ||
    !bookingId ||
    !interviewerProfileId ||
    !candidateProfileId ||
    overallRating === null ||
    technicalExpertise === null ||
    communication === null ||
    interviewRealism === null ||
    feedbackQuality === null ||
    professionalism === null ||
    !recommend ||
    !isRecommendLevel(recommend) ||
    writtenReview === null ||
    !displayName ||
    !moderationStatus ||
    !isModerationStatus(moderationStatus) ||
    !createdAt
  ) {
    return null
  }
  return {
    id,
    bookingId,
    interviewerProfileId,
    candidateProfileId,
    overallRating,
    technicalExpertise,
    communication,
    interviewRealism,
    feedbackQuality,
    professionalism,
    recommend,
    writtenReview,
    showNamePublicly: readBoolean(row, 'show_name_publicly') ?? false,
    displayName,
    moderationStatus,
    createdAt,
  }
}

export function parsePublicCandidateReview(value: unknown) {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const displayName = readString(row, 'display_name')
  const overallRating = readNumber(row, 'overall_rating')
  const writtenReview = readString(row, 'written_review')
  const createdAt = readString(row, 'created_at')
  if (!id || !interviewerProfileId || !displayName || overallRating === null || writtenReview === null || !createdAt) {
    return null
  }
  return {
    id,
    interviewerProfileId,
    displayName,
    overallRating,
    technicalExpertise: readNumber(row, 'technical_expertise'),
    communication: readNumber(row, 'communication'),
    interviewRealism: readNumber(row, 'interview_realism'),
    feedbackQuality: readNumber(row, 'feedback_quality'),
    professionalism: readNumber(row, 'professionalism'),
    recommend: readString(row, 'recommend'),
    writtenReview,
    createdAt,
  }
}
