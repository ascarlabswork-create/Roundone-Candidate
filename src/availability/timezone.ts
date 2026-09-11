export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export type WeekdayName = (typeof WEEKDAY_NAMES)[number]

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = zoneParts(date, timeZone)
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUTC - date.getTime()
}

/** Interpret a civil date + wall clock in `timeZone` as a UTC instant. Stored as UTC ISO later. */
export function wallTimeInZoneToUtc(dateISO: string, timeHHMM: string, timeZone: string) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const [hour, minute] = timeHHMM.split(':').map(Number)
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0)
  for (let i = 0; i < 4; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utc), timeZone)
    utc = Date.UTC(year, month - 1, day, hour, minute, 0) - offset
  }
  return new Date(utc)
}

export function isoDateInZone(date: Date, timeZone: string) {
  const parts = zoneParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function weekdayInZone(date: Date, timeZone: string): WeekdayName {
  const weekday = zoneParts(date, timeZone).weekday as WeekdayName
  return weekday
}

export function weekdayOfCivilDate(dateISO: string): WeekdayName {
  const [year, month, day] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return WEEKDAY_NAMES[date.getUTCDay()]
}

export function addCivilDays(dateISO: string, days: number) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftCivilDateFromNow(days: number, timeZone: string) {
  return addCivilDays(isoDateInZone(new Date(), timeZone), days)
}

export function formatTimeInZone(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateTimeInZone(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatCivilDateLong(dateISO: string) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}
