const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function parseSlot(iso: string) {
  return new Date(iso)
}

export function formatSlot(iso: string) {
  const date = parseSlot(iso)
  const weekday = WEEKDAYS[date.getDay()]
  const time = date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${weekday}, ${time}`
}

export function formatDateLong(iso: string) {
  return parseSlot(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(iso: string) {
  return parseSlot(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string) {
  return parseSlot(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekdayName(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  return WEEKDAYS[date.getDay()]
}

/** Date-only YYYY-MM-DD comparison. An empty range is valid. End may be omitted. */
export function preferredDateRangeError(startDate: string, endDate: string): string | null {
  if (!startDate && !endDate) return null
  if (!startDate && endDate) return 'Choose a start date for your preferred range.'
  if (startDate && endDate && endDate < startDate) {
    return 'Preferred end date must be on or after the start date.'
  }
  return null
}

/** Inclusive end of a preferred date range; falls back to the start date. */
export function preferredRangeEnd(startDate: string, endDate?: string | null) {
  if (!startDate) return ''
  if (endDate && endDate >= startDate) return endDate
  return startDate
}

export function dateInPreferredRange(isoDate: string, startDate: string, endDate?: string | null) {
  if (!startDate) return true
  const end = preferredRangeEnd(startDate, endDate)
  return isoDate >= startDate && isoDate <= end
}

/** Compact label like "24–27 Sep" or a single weekday when start === end. */
export function preferredDateRangeLabel(startDate: string, endDate?: string | null) {
  if (!startDate) return ''
  const end = preferredRangeEnd(startDate, endDate)
  if (end === startDate) return weekdayName(startDate)

  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const start = new Date(sy, (sm ?? 1) - 1, sd ?? 1)
  const finish = new Date(ey, (em ?? 1) - 1, ed ?? 1)
  const startDay = start.getDate()
  const endDay = finish.getDate()
  const sameMonth = start.getFullYear() === finish.getFullYear() && start.getMonth() === finish.getMonth()
  if (sameMonth) {
    const month = start.toLocaleDateString('en-IN', { month: 'short' })
    return `${startDay}–${endDay} ${month}`
  }
  const startLabel = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const endLabel = finish.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${startLabel} – ${endLabel}`
}

export function timeWindowLabel(window: string) {
  if (window === 'morning') return 'morning'
  if (window === 'afternoon') return 'afternoon'
  if (window === 'evening') return 'evening'
  return ''
}

export function hoursForWindow(window: string) {
  if (window === 'morning') return { start: 8, end: 12 }
  if (window === 'afternoon') return { start: 12, end: 17 }
  if (window === 'evening') return { start: 17, end: 21 }
  return null
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}
