import { asRecord, readNullableString, readString } from '../lib/rows.ts'
import { toUtcIso } from './bookableSlots.ts'
import type { CandidateBooking } from './bookingModel.ts'

/** LiveKit room opens this long before `bookings.starts_at`. */
export const ROOM_OPENS_BEFORE_MS = 15 * 60_000

/** Alias for the same early-join window used by lobby copy and countdowns. */
export const LOBBY_OPENS_BEFORE_MS = ROOM_OPENS_BEFORE_MS

/** A new participant may join until this long after `bookings.starts_at`. */
export const LATE_JOIN_AFTER_MS = 15 * 60_000

export function interviewRoomOpensAtUtc(startsAtUtc: string) {
  return new Date(new Date(startsAtUtc).getTime() - ROOM_OPENS_BEFORE_MS).toISOString()
}

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
  | 'lobby'
  | 'joinable'
  | 'in_progress'
  | 'closed'
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
  if (status === 'rescheduled') return 'Rescheduled'
  return status
}

export const INTERVIEW_HISTORY_LIMIT = 50

export type InterviewHistorySection = 'upcoming' | 'completed' | 'cancelled'

export function interviewHistorySection(status: string): InterviewHistorySection | null {
  if (status === 'confirmed' || status === 'in_progress' || status === 'requested') return 'upcoming'
  if (status === 'completed') return 'completed'
  if (
    status === 'cancelled' ||
    status === 'no_show' ||
    status === 'rejected' ||
    status === 'expired' ||
    status === 'rescheduled' ||
    status === 'pending_payment'
  ) {
    return 'cancelled'
  }
  return null
}

export function sortUpcomingInterviews<T extends { startsAtUtc: string }>(items: T[]) {
  return [...items].sort((left, right) => left.startsAtUtc.localeCompare(right.startsAtUtc))
}

/** Bookings the candidate should see as upcoming. Requested rows have no session yet. */
export function isCandidateUpcomingInterview(
  booking: { status: string; endsAtUtc: string },
  session: { endedAt: string | null } | null,
  now = new Date(),
) {
  if (session?.endedAt) return false
  const endsAt = new Date(booking.endsAtUtc).getTime()
  if (Number.isNaN(endsAt) || endsAt < now.getTime()) return false
  if (booking.status === 'requested') return true
  if (booking.status === 'in_progress') return true
  if (booking.status === 'confirmed') return session != null
  return false
}

export function sortRecentInterviews<T extends { startsAtUtc: string }>(items: T[]) {
  return [...items].sort((left, right) => right.startsAtUtc.localeCompare(left.startsAtUtc))
}

export function groupInterviewHistory<T extends { status: string; startsAtUtc: string }>(items: T[]) {
  const upcoming: T[] = []
  const completed: T[] = []
  const cancelled: T[] = []
  for (const item of items) {
    const section = interviewHistorySection(item.status)
    if (section === 'upcoming') upcoming.push(item)
    else if (section === 'completed') completed.push(item)
    else if (section === 'cancelled') cancelled.push(item)
  }
  return {
    upcoming: sortUpcomingInterviews(upcoming),
    completed: sortRecentInterviews(completed),
    cancelled: sortRecentInterviews(cancelled),
  }
}

export function interviewSchedule(startsAtUtc: string, endsAtUtc: string) {
  const start = new Date(startsAtUtc).getTime()
  const end = new Date(endsAtUtc).getTime()
  return { start, end }
}

export function interviewJoinState(
  booking: Pick<CandidateBooking, 'status' | 'startsAtUtc' | 'endsAtUtc'>,
  session: Pick<CandidateInterviewSession, 'endedAt'> | null,
  now = new Date(),
): InterviewJoinState {
  const status = booking.status
  if (status === 'completed') return 'completed'
  if (status === 'cancelled' || status === 'rescheduled') return 'cancelled'
  if (status === 'no_show') return 'no_show'
  if (!session) return 'no_session'
  if (session.endedAt) return 'completed'

  const { start, end } = interviewSchedule(booking.startsAtUtc, booking.endsAtUtc)
  const t = now.getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 'unavailable'
  if (t >= end) return status === 'in_progress' || status === 'confirmed' ? 'completed' : 'unavailable'
  if (status === 'in_progress') {
    if (t >= start - ROOM_OPENS_BEFORE_MS) return 'in_progress'
    return 'upcoming'
  }
  if (status !== 'confirmed') return 'unavailable'
  if (t > start + LATE_JOIN_AFTER_MS) return 'closed'
  if (t >= start) return 'joinable'
  if (t >= start - ROOM_OPENS_BEFORE_MS) return 'lobby'
  return 'upcoming'
}

export function canJoinInterview(
  booking: Pick<CandidateBooking, 'status' | 'startsAtUtc' | 'endsAtUtc'>,
  session: Pick<CandidateInterviewSession, 'endedAt'> | null,
  now = new Date(),
) {
  const state = interviewJoinState(booking, session, now)
  return state === 'lobby' || state === 'joinable' || state === 'in_progress'
}

export function canViewInterview(
  booking: Pick<CandidateBooking, 'status'>,
  session: CandidateInterviewSession | null,
) {
  if (!session) return false
  return booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed'
}
