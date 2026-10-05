import { filterSlotsByPreferredRange, type UtcBookableSlot } from '../services/bookableSlots.ts'

/** Booking offer on a skill match. Skill overlap is decided separately. */
export type BookingReadiness = 'ready' | 'no_service' | 'no_availability' | 'outside_range'

export function classifyBookingReadiness(input: {
  serviceCount: number
  slots: UtcBookableSlot[]
  timezone: string
  preferredDate?: string | null
  preferredDateEnd?: string | null
}): BookingReadiness {
  if (input.serviceCount <= 0) return 'no_service'
  if (input.slots.length === 0) return 'no_availability'
  if (!input.preferredDate) return 'ready'
  const inRange = filterSlotsByPreferredRange(
    input.slots,
    input.timezone,
    input.preferredDate,
    input.preferredDateEnd,
  )
  return inRange.length > 0 ? 'ready' : 'outside_range'
}

export function bookingStatusMessage(readiness: BookingReadiness): { headline: string; detail: string } | null {
  if (readiness === 'ready') return null
  if (readiness === 'no_service') {
    return { headline: 'Matched by skills', detail: 'Booking not available yet' }
  }
  if (readiness === 'no_availability') {
    return { headline: 'Matched by skills', detail: 'Availability not configured' }
  }
  return { headline: 'Matched by skills', detail: 'No openings in your preferred dates' }
}
