import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  BookingError,
  getCandidateBooking,
  listCandidateBookings,
  type CandidateBooking,
} from './bookings.ts'
import { getCandidateFeedbackBookingIds } from './candidateFeedback.ts'
import { getPublicInterviewer, getPublicInterviewerService } from './interviewerPublic.ts'
import { parseInterviewSession, type CandidateInterviewSession } from './interviewSessionModel.ts'

export type { CandidateInterviewSession } from './interviewSessionModel.ts'
export {
  canJoinInterview,
  canViewInterview,
  interviewJoinState,
  interviewStatusLabel,
  parseInterviewSession,
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
}

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new BookingError('unauthenticated', 'Please sign in to view your interviews.')
  }
  return data.user
}

async function decorateBooking(
  booking: CandidateBooking,
  session: CandidateInterviewSession | null,
  hasFeedback: boolean,
): Promise<CandidateInterview> {
  let interviewerName = 'Interviewer'
  let interviewerPhoto: string | null = null
  let interviewerCompany: string | null = null
  let serviceName = 'Interview'
  let interviewType = 'Interview'
  try {
    const [interviewer, service] = await Promise.all([
      getPublicInterviewer(booking.interviewerProfileId),
      getPublicInterviewerService(booking.serviceId),
    ])
    interviewerName = interviewer?.name ?? interviewerName
    interviewerPhoto = interviewer?.photo ?? null
    interviewerCompany = interviewer?.company ?? null
    serviceName = service?.name ?? serviceName
    interviewType = service?.interviewType ?? interviewType
  } catch (error) {
    console.error('decorateBooking extras failed', error)
  }
  return {
    ...booking,
    interviewerName,
    interviewerPhoto,
    interviewerCompany,
    serviceName,
    interviewType,
    session,
    hasFeedback,
  }
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
  const [sessionResult, feedbackIds] = await Promise.all([
    supabase.from('interview_sessions').select(SESSION_SELECT).in('booking_id', ids),
    getCandidateFeedbackBookingIds(ids),
  ])

  if (sessionResult.error) {
    console.error('getCandidateInterviewSessions failed', sessionResult.error)
    throw new BookingError('rpc', 'Unable to load your interview sessions.')
  }

  const sessions = new Map<string, CandidateInterviewSession>()
  if (Array.isArray(sessionResult.data)) {
    for (const row of sessionResult.data) {
      const session = parseInterviewSession(row)
      if (session) sessions.set(session.bookingId, session)
    }
  }

  return Promise.all(
    bookings.map((booking) =>
      decorateBooking(booking, sessions.get(booking.id) ?? null, feedbackIds.has(booking.id)),
    ),
  )
}

export async function getCandidateUpcomingInterviews(): Promise<CandidateInterview[]> {
  const interviews = await getCandidateInterviewSessions()
  const now = Date.now()
  return interviews
    .filter((item) => {
      if (!item.session) return false
      if (item.status === 'in_progress') return true
      if (item.status !== 'confirmed') return false
      return new Date(item.endsAtUtc).getTime() >= now
    })
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))
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

  const [session, feedbackIds] = await Promise.all([
    getInterviewSessionByBooking(booking.id),
    getCandidateFeedbackBookingIds([booking.id]),
  ])
  return decorateBooking(booking, session, feedbackIds.has(booking.id))
}
