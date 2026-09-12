/**
 * Candidate booking consumes generated slots only.
 *
 * Future interviewer availability page (not in this candidate app) will edit:
 * - Recurring Availability (day + start/end)
 * - Custom Available Slots (specific date + window)
 * - Blocked Dates
 * - Timezone
 * - Booking Buffer
 *
 * Production: store those rows in Supabase, persist bookings in UTC, and run
 * this same generator on the backend before creating a booking.
 */
export type {
  BlockedInterval,
  BookableDay,
  BookableSlot,
  CustomAvailability,
  InterviewerAvailability,
  OccupiedInterval,
  RecurringAvailability,
  SlotGenerationInput,
  WeekdayName,
} from './types.ts'
export { findBookableSlot, generateBookableSlots, groupSlotsByDate } from './generateSlots.ts'
export {
  addCivilDays,
  formatBookingTime,
  formatCivilDateCard,
  formatCivilDateLong,
  formatCivilDateWithYear,
  formatDateTimeInZone,
  formatTimeInZone,
  isoDateInZone,
  shiftCivilDateFromNow,
  wallTimeInZoneToUtc,
  weekdayOfCivilDate,
} from './timezone.ts'
