import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  BookingError,
  mapBookingError,
  parseCandidateBooking,
  validateCreateBookingInput,
  type CandidateBooking,
  type CreateBookingInput,
} from './bookingModel.ts'
import { toUtcIso } from './bookableSlots.ts'
import { getPublicInterviewer, getPublicInterviewerService } from './interviewerPublic.ts'

export type { CandidateBooking, CreateBookingInput } from './bookingModel.ts'
export {
  BookingError,
  formatHoldCountdown,
  isHoldExpired,
  mapBookingError,
  parseCandidateBooking,
  remainingHoldMs,
  sameHeldSlot,
  validateCreateBookingInput,
} from './bookingModel.ts'

export type CandidateBookingView = CandidateBooking & {
  interviewerName: string
  interviewerPhoto: string | null
  serviceName: string
}

const BOOKING_SELECT =
  'id, candidate_profile_id, interviewer_profile_id, service_id, status, starts_at, ends_at, display_timezone, duration_min, session_fee_paise, platform_fee_paise, total_paise, currency, hold_expires_at, mode, rescheduled_from_booking_id'

const BOOKING_LIST_LIMIT = 50

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new BookingError('unauthenticated', 'Please sign in to complete your booking.')
  }
  return data.user
}

export async function createBooking(input: CreateBookingInput): Promise<CandidateBooking> {
  await requireAuthenticatedUser()
  const validation = validateCreateBookingInput(input)
  if (validation) throw new BookingError('validation', validation)

  const startsAtUtc = toUtcIso(input.startsAtUtc)
  if (!startsAtUtc) throw new BookingError('validation', 'Select a date and time before confirming.')

  const { data, error } = await supabase.rpc('create_booking', {
    p_service_id: input.serviceId,
    p_starts_at: startsAtUtc,
    p_display_timezone: input.displayTimezone.trim(),
  })

  if (error) {
    console.error('create_booking failed', error)
    throw mapBookingError(error)
  }

  const booking = parseCandidateBooking(data)
  if (!booking) {
    throw new BookingError('rpc', 'Unable to create your booking. Please try again.')
  }
  return booking
}

export async function listCandidateBookings(): Promise<CandidateBooking[]> {
  await requireAuthenticatedUser()
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('starts_at', { ascending: false })
    .limit(BOOKING_LIST_LIMIT)

  if (error) {
    console.error('listCandidateBookings failed', error)
    const mapped = mapBookingError(error)
    if (mapped.code === 'unauthenticated') throw mapped
    if (mapped.code === 'network') {
      throw new BookingError('network', 'Unable to load your interviews. Check your connection.')
    }
    throw new BookingError('rpc', 'Unable to load your interviews. Please try again.')
  }

  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const booking = parseCandidateBooking(row)
    return booking ? [booking] : []
  })
}

export async function getCandidateBooking(bookingId: string): Promise<CandidateBooking> {
  await requireAuthenticatedUser()
  if (!isUuid(bookingId)) {
    throw new BookingError('not_found', 'We could not find that booking.')
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('getCandidateBooking failed', error)
    throw mapBookingError(error)
  }

  const booking = parseCandidateBooking(data)
  if (!booking) {
    throw new BookingError('not_found', 'We could not find that booking.')
  }
  return booking
}

export async function getCandidateBookingView(bookingId: string): Promise<CandidateBookingView> {
  const booking = await getCandidateBooking(bookingId)
  let interviewerName = 'Interviewer'
  let interviewerPhoto: string | null = null
  let serviceName = 'Interview'
  try {
    const [interviewer, service] = await Promise.all([
      getPublicInterviewer(booking.interviewerProfileId),
      getPublicInterviewerService(booking.serviceId),
    ])
    interviewerName = interviewer?.name ?? interviewerName
    interviewerPhoto = interviewer?.photo ?? null
    serviceName = service?.name ?? serviceName
  } catch (error) {
    console.error('getCandidateBookingView extras failed', error)
  }
  return {
    ...booking,
    interviewerName,
    interviewerPhoto,
    serviceName,
  }
}
