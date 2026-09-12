export type WeekdayName =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'

/** Interviewer-controlled weekly hours, in the interviewer's timezone. */
export type RecurringAvailability = {
  day: WeekdayName
  startTime: string
  endTime: string
}

/** One-off extra window the interviewer opened, civil date in interviewer TZ. */
export type CustomAvailability = {
  date: string
  startTime: string
  endTime: string
}

/** Interviewer blocked the window so candidates cannot book it. */
export type BlockedInterval = {
  date: string
  startTime?: string
  endTime?: string
  allDay?: boolean
  reason?: string
}

/**
 * Source of truth for when candidates may book.
 * Future interviewer availability page will edit these fields:
 * Recurring Availability, Custom Available Slots, Blocked Dates, Timezone, Booking Buffer.
 */
export type InterviewerAvailability = {
  timezone: string
  bookingBufferMin: number
  recurring: RecurringAvailability[]
  custom: CustomAvailability[]
  blocked: BlockedInterval[]
}

/** Generated bookable slot. Instants are UTC ISO strings. */
export type BookableSlot = {
  id: string
  start: string
  end: string
  durationMin: number
}

export type OccupiedInterval = {
  start: string
  end: string
}

export type SlotGenerationInput = {
  interviewerId: string
  availability: InterviewerAvailability
  durationMin: number
  occupied: OccupiedInterval[]
  from?: Date
  horizonDays?: number
}

export type BookableDay = {
  date: string
  slots: BookableSlot[]
}
