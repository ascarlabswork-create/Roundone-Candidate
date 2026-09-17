import { asRecord, readNullableString, readString } from '../lib/rows.ts'
import { toUtcIso } from './bookableSlots.ts'
import type { CandidateBooking } from './bookingModel.ts'

export const JOIN_WINDOW_BEFORE_MS = 15 * 60_000

export type CandidateInterviewSession = {
  id: string
  bookingId: string
  provider: string
  startedAt: string | null
  endedAt: string | null
}

export type InterviewJoinState =
  | 'no_session'
  | 'upcoming'
  | 'joinable'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'unavailable'

export function parseInterviewSession(value: unknown): CandidateInterviewSession | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const bookingId = readString(row, 'booking_id')
  const provider = readString(row, 'provider') ?? 'stub'
  if (!id || !bookingId) return null
  return {
    id,
    bookingId,
    provider,
    startedAt: toUtcIso(row.started_at) ?? readNullableString(row, 'started_at'),
    endedAt: toUtcIso(row.ended_at) ?? readNullableString(row, 'ended_at'),
  }
}

export function interviewStatusLabel(status: string) {
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'in_progress') return 'In progress'
  if (status === 'completed') return 'Interview Completed'
  if (status === 'cancelled') return 'Interview Cancelled'
  if (status === 'no_show') return 'Interview marked as no-show'
  if (status === 'requested') return 'Awaiting interviewer confirmation'
  if (status === 'pending_payment') return 'Payment pending'
  if (status === 'rejected') return 'Booking declined'
  if (status === 'expired') return 'Hold expired'
  return status
}

export function interviewJoinState(
  booking: Pick<CandidateBooking, 'status' | 'startsAtUtc' | 'endsAtUtc'>,
  session: Pick<CandidateInterviewSession, 'endedAt'> | null,
  now = new Date(),
): InterviewJoinState {
  const status = booking.status
  if (status === 'completed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'no_show') return 'no_show'
  if (!session) return 'no_session'
  if (session.endedAt) return 'completed'
  if (status === 'in_progress') return 'in_progress'
  if (status !== 'confirmed') return 'unavailable'

  const start = new Date(booking.startsAtUtc).getTime()
  const end = new Date(booking.endsAtUtc).getTime()
  const t = now.getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 'unavailable'
  if (t > end) return 'upcoming'
  if (t >= start - JOIN_WINDOW_BEFORE_MS) return 'joinable'
  return 'upcoming'
}

export function canJoinInterview(
  booking: Pick<CandidateBooking, 'status' | 'startsAtUtc' | 'endsAtUtc'>,
  session: Pick<CandidateInterviewSession, 'endedAt'> | null,
  now = new Date(),
) {
  const state = interviewJoinState(booking, session, now)
  return state === 'joinable' || state === 'in_progress'
}

export function canViewInterview(
  booking: Pick<CandidateBooking, 'status'>,
  session: CandidateInterviewSession | null,
) {
  if (!session) return false
  return booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed'
}
