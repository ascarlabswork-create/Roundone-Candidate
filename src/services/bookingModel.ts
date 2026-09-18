import { asRecord, readNumber, readNullableString, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'
import { toUtcIso } from './bookableSlots.ts'

export type BookingErrorCode =
  | 'unauthenticated'
  | 'validation'
  | 'slot_unavailable'
  | 'invalid_service'
  | 'interviewer_unavailable'
  | 'not_found'
  | 'network'
  | 'rpc'

export class BookingError extends Error {
  readonly code: BookingErrorCode

  constructor(code: BookingErrorCode, message: string) {
    super(message)
    this.name = 'BookingError'
    this.code = code
  }
}

export type CreateBookingInput = {
  serviceId: string
  startsAtUtc: string
  displayTimezone: string
  endsAtUtc?: string
  interviewerProfileId?: string
}

export type CandidateBooking = {
  id: string
  candidateProfileId: string
  interviewerProfileId: string
  serviceId: string
  status: string
  startsAtUtc: string
  endsAtUtc: string
  displayTimezone: string
  durationMin: number
  sessionFeePaise: number
  platformFeePaise: number
  totalPaise: number
  currency: string
  holdExpiresAt: string | null
  mode: string
  rescheduledFromBookingId: string | null
}

export function remainingHoldMs(holdExpiresAt: string | null, now = new Date()) {
  if (!holdExpiresAt) return 0
  const end = new Date(holdExpiresAt).getTime()
  if (Number.isNaN(end)) return 0
  return Math.max(0, end - now.getTime())
}

export function formatHoldCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function isHoldExpired(booking: Pick<CandidateBooking, 'status' | 'holdExpiresAt'>, now = new Date()) {
  if (booking.status === 'expired') return true
  if (booking.status !== 'pending_payment') return false
  return remainingHoldMs(booking.holdExpiresAt, now) <= 0
}

export function validateCreateBookingInput(input: CreateBookingInput): string | null {
  if (!isUuid(input.serviceId)) return 'Select an active interview service before confirming.'
  if (input.interviewerProfileId && !isUuid(input.interviewerProfileId)) {
    return 'Select an interviewer before confirming.'
  }
  const startsAtUtc = toUtcIso(input.startsAtUtc)
  if (!startsAtUtc) return 'Select a date and time before confirming.'
  if (input.endsAtUtc !== undefined && input.endsAtUtc !== '') {
    const endsAtUtc = toUtcIso(input.endsAtUtc)
    if (!endsAtUtc) return 'The selected time slot is incomplete. Choose a date and time again.'
    if (new Date(endsAtUtc).getTime() <= new Date(startsAtUtc).getTime()) {
      return 'The selected time slot is invalid. Choose a date and time again.'
    }
  }
  if (!input.displayTimezone.trim()) return 'Choose a timezone before confirming.'
  return null
}

function errorText(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const record = error as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  const details = typeof record.details === 'string' ? record.details : ''
  const code = typeof record.code === 'string' ? record.code : ''
  return `${code} ${message} ${details}`.toLowerCase()
}

export function mapBookingError(error: unknown): BookingError {
  const text = errorText(error)
  const rawMessage = error instanceof Error ? error.message : ''

  if (
    text.includes('not_authenticated') ||
    text.includes('not_a_candidate') ||
    text.includes('auth session missing') ||
    text.includes('jwt') ||
    rawMessage.toLowerCase().includes('sign in')
  ) {
    return new BookingError('unauthenticated', 'Please sign in to complete your booking.')
  }
  if (text.includes('slot_unavailable') || text.includes('23p01') || text.includes('exclusion') || text.includes('overlap')) {
    return new BookingError('slot_unavailable', 'This slot was just taken.')
  }
  if (text.includes('service_not_found')) {
    return new BookingError('invalid_service', 'This service is no longer available.')
  }
  if (text.includes('interviewer_not_listed') || text.includes('interviewer_unavailable')) {
    return new BookingError('interviewer_unavailable', 'This interviewer is not available to book.')
  }
  if (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    rawMessage.toLowerCase().includes('network')
  ) {
    return new BookingError('network', 'Unable to create your booking. Check your connection and try again.')
  }
  return new BookingError('rpc', 'Unable to create your booking. Please try again.')
}

export function parseCandidateBooking(value: unknown): CandidateBooking | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const candidateProfileId = readString(row, 'candidate_profile_id')
  const interviewerProfileId = readString(row, 'interviewer_profile_id')
  const serviceId = readString(row, 'service_id')
  const status = readString(row, 'status')
  const startsAtUtc = toUtcIso(row.starts_at)
  const endsAtUtc = toUtcIso(row.ends_at)
  const displayTimezone = readString(row, 'display_timezone')
  const durationMin = readNumber(row, 'duration_min')
  const sessionFeePaise = readNumber(row, 'session_fee_paise')
  const platformFeePaise = readNumber(row, 'platform_fee_paise')
  const totalPaise = readNumber(row, 'total_paise')
  const currency = readString(row, 'currency')
  const mode = readString(row, 'mode') ?? 'video'
  const holdExpiresAt = toUtcIso(row.hold_expires_at) ?? readNullableString(row, 'hold_expires_at')
  if (
    !id ||
    !candidateProfileId ||
    !interviewerProfileId ||
    !serviceId ||
    !status ||
    !startsAtUtc ||
    !endsAtUtc ||
    !displayTimezone ||
    durationMin === null ||
    sessionFeePaise === null ||
    platformFeePaise === null ||
    totalPaise === null ||
    !currency
  ) {
    return null
  }
  return {
    id,
    candidateProfileId,
    interviewerProfileId,
    serviceId,
    status,
    startsAtUtc,
    endsAtUtc,
    displayTimezone,
    durationMin,
    sessionFeePaise,
    platformFeePaise,
    totalPaise,
    currency,
    holdExpiresAt,
    mode,
    rescheduledFromBookingId: readNullableString(row, 'rescheduled_from_booking_id'),
  }
}

export function sameHeldSlot(booking: CandidateBooking, input: CreateBookingInput) {
  const start = toUtcIso(input.startsAtUtc)
  return (
    booking.status === 'pending_payment' &&
    booking.serviceId === input.serviceId &&
    Boolean(start) &&
    booking.startsAtUtc === start &&
    !isHoldExpired(booking)
  )
}
