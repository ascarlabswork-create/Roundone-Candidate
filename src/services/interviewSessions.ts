import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  BookingError,
  getCandidateBooking,
  listCandidateBookings,
  type CandidateBooking,
} from './bookings.ts'
import { getCandidateFeedbackBookingIds } from './candidateFeedback.ts'
import { getCandidateReviewBookingIds } from './candidateReviews.ts'
import { getPublicInterviewersByIds, getPublicServicesByIds } from './interviewerPublic.ts'
import {
  parseInterviewSession,
  sortUpcomingInterviews,
  type CandidateInterviewSession,
} from './interviewSessionModel.ts'

export type { CandidateInterviewSession } from './interviewSessionModel.ts'
export {
  INTERVIEW_HISTORY_LIMIT,
  canJoinInterview,
  canViewInterview,
  groupInterviewHistory,
  interviewHistorySection,
  interviewJoinState,
  interviewStatusLabel,
  parseInterviewSession,
  sortRecentInterviews,
  sortUpcomingInterviews,
} from './interviewSessionModel.ts'

const SESSION_SELECT = 'id, booking_id, provider, started_at, ended_at'

export type CandidateInterview = CandidateBooking & {
  interviewerName: string
  interviewerPhoto: string | null
  interviewerCompany: string | null
  serviceName: string
  interviewType: string
  session: CandidateInterviewSession | null
  hasFeedback: boolean
  hasReview: boolean
}

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new BookingError('unauthenticated', 'Please sign in to view your interviews.')
  }
  return data.user
}

async function decorateBookings(
  bookings: CandidateBooking[],
  sessions: Map<string, CandidateInterviewSession>,
  feedbackIds: Set<string>,
  reviewIds: Set<string>,
): Promise<CandidateInterview[]> {
  if (bookings.length === 0) return []

  const [interviewers, services] = await Promise.all([
    getPublicInterviewersByIds(bookings.map((booking) => booking.interviewerProfileId)),
    getPublicServicesByIds(bookings.map((booking) => booking.serviceId)),
  ])

  return bookings.map((booking) => {
    const interviewer = interviewers.get(booking.interviewerProfileId)
    const service = services.get(booking.serviceId)
    return {
      ...booking,
      interviewerName: interviewer?.name ?? 'Interviewer',
      interviewerPhoto: interviewer?.photo ?? null,
      interviewerCompany: interviewer?.company ?? null,
      serviceName: service?.name ?? 'Interview',
      interviewType: service?.interviewType ?? 'Interview',
      session: sessions.get(booking.id) ?? null,
      hasFeedback: feedbackIds.has(booking.id),
      hasReview: reviewIds.has(booking.id),
    }
  })
}

export async function getInterviewSessionByBooking(bookingId: string): Promise<CandidateInterviewSession | null> {
  await requireAuthenticatedUser()
  if (!isUuid(bookingId)) {
    throw new BookingError('not_found', 'We could not find that interview.')
  }

  const { data, error } = await supabase
    .from('interview_sessions')
    .select(SESSION_SELECT)
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('getInterviewSessionByBooking failed', error)
    throw new BookingError('rpc', 'Unable to load this interview session.')
  }
  if (!data) return null
  return parseInterviewSession(data)
}

export async function getCandidateInterviewSessions(): Promise<CandidateInterview[]> {
  await requireAuthenticatedUser()
  const bookings = await listCandidateBookings()
  if (!bookings.length) return []

  const ids = bookings.map((booking) => booking.id)
  const sessions = new Map<string, CandidateInterviewSession>()
  let feedbackIds = new Set<string>()
  let reviewIds = new Set<string>()

  const [sessionResult, feedbackResult, reviewResult] = await Promise.allSettled([
    supabase.from('interview_sessions').select(SESSION_SELECT).in('booking_id', ids),
    getCandidateFeedbackBookingIds(ids),
    getCandidateReviewBookingIds(ids),
  ])

  if (sessionResult.status === 'fulfilled') {
    if (sessionResult.value.error) {
      console.error('getCandidateInterviewSessions failed', sessionResult.value.error)
    } else if (Array.isArray(sessionResult.value.data)) {
      for (const row of sessionResult.value.data) {
        const session = parseInterviewSession(row)
        if (session) sessions.set(session.bookingId, session)
      }
    }
  } else {
    console.error('getCandidateInterviewSessions failed', sessionResult.reason)
  }

  if (feedbackResult.status === 'fulfilled') feedbackIds = feedbackResult.value
  else console.error('getCandidateFeedbackBookingIds failed', feedbackResult.reason)

  if (reviewResult.status === 'fulfilled') reviewIds = reviewResult.value
  else console.error('getCandidateReviewBookingIds failed', reviewResult.reason)

  return decorateBookings(bookings, sessions, feedbackIds, reviewIds)
}

export async function getCandidateUpcomingInterviews(): Promise<CandidateInterview[]> {
  const interviews = await getCandidateInterviewSessions()
  const now = Date.now()
  return sortUpcomingInterviews(
    interviews.filter((item) => {
      if (!item.session) return false
      if (item.status === 'in_progress') return true
      if (item.status !== 'confirmed') return false
      return new Date(item.endsAtUtc).getTime() >= now
    }),
  )
}

export async function getCandidateInterviewByBooking(bookingId: string): Promise<CandidateInterview> {
  await requireAuthenticatedUser()
  if (!isUuid(bookingId)) {
    throw new BookingError('not_found', 'You don’t have access to this interview.')
  }

  let booking: CandidateBooking
  try {
    booking = await getCandidateBooking(bookingId)
  } catch (error) {
    if (error instanceof BookingError && (error.code === 'not_found' || error.code === 'unauthenticated')) {
      throw new BookingError(error.code, 'You don’t have access to this interview.')
    }
    throw error
  }

  const sessions = new Map<string, CandidateInterviewSession>()
  let feedbackIds = new Set<string>()
  let reviewIds = new Set<string>()
  const [sessionResult, feedbackResult, reviewResult] = await Promise.allSettled([
    getInterviewSessionByBooking(booking.id),
    getCandidateFeedbackBookingIds([booking.id]),
    getCandidateReviewBookingIds([booking.id]),
  ])

  if (sessionResult.status === 'fulfilled' && sessionResult.value) {
    sessions.set(booking.id, sessionResult.value)
  } else if (sessionResult.status === 'rejected') {
    console.error('getInterviewSessionByBooking failed', sessionResult.reason)
  }

  if (feedbackResult.status === 'fulfilled') feedbackIds = feedbackResult.value
  else console.error('getCandidateFeedbackBookingIds failed', feedbackResult.reason)

  if (reviewResult.status === 'fulfilled') reviewIds = reviewResult.value
  else console.error('getCandidateReviewBookingIds failed', reviewResult.reason)

  const [interview] = await decorateBookings([booking], sessions, feedbackIds, reviewIds)
  if (!interview) {
    throw new BookingError('rpc', 'Unable to load this interview.')
  }
  return interview
}
