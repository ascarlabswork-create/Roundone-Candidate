import { isoDateInZone } from '../availability/timezone.ts'

export const BOOKABLE_WINDOW_DAYS = 14
const MS_PER_DAY = 24 * 60 * 60 * 1000

export type UtcBookableSlot = {
  startsAtUtc: string
  endsAtUtc: string
}

export type DisplayBookableDay = {
  date: string
  slots: UtcBookableSlot[]
}

export type BookableSlotsQuery = {
  interviewerProfileId: string
  serviceId: string
  from: Date
  to: Date
}

export function getBookableWindow(windowIndex: number, now = new Date()) {
  const index = Math.max(0, Math.floor(windowIndex))
  const from = new Date(now.getTime() + index * BOOKABLE_WINDOW_DAYS * MS_PER_DAY)
  const to = new Date(from.getTime() + BOOKABLE_WINDOW_DAYS * MS_PER_DAY)
  return { from, to }
}

export function toUtcIso(value: unknown): string | null {
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  return null
}

export function parseBookableSlotRows(data: unknown): UtcBookableSlot[] {
  if (!Array.isArray(data)) return []
  const slots: UtcBookableSlot[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    const startsAtUtc = toUtcIso(row.starts_at)
    const endsAtUtc = toUtcIso(row.ends_at)
    if (!startsAtUtc || !endsAtUtc) continue
    if (new Date(endsAtUtc).getTime() <= new Date(startsAtUtc).getTime()) continue
    slots.push({ startsAtUtc, endsAtUtc })
  }
  return slots.sort((a, b) => (a.startsAtUtc < b.startsAtUtc ? -1 : a.startsAtUtc > b.startsAtUtc ? 1 : 0))
}

export function sameUtcSlot(a: UtcBookableSlot, b: Pick<UtcBookableSlot, 'startsAtUtc' | 'endsAtUtc'>) {
  return toUtcIso(a.startsAtUtc) === toUtcIso(b.startsAtUtc) && toUtcIso(a.endsAtUtc) === toUtcIso(b.endsAtUtc)
}

export function findSlot(
  slots: UtcBookableSlot[],
  target: Pick<UtcBookableSlot, 'startsAtUtc'> & Partial<Pick<UtcBookableSlot, 'endsAtUtc'>>,
) {
  const start = toUtcIso(target.startsAtUtc)
  if (!start) return null
  const end = target.endsAtUtc ? toUtcIso(target.endsAtUtc) : null
  return (
    slots.find((slot) => {
      if (slot.startsAtUtc !== start) return false
      return end ? slot.endsAtUtc === end : true
    }) ?? null
  )
}

/**
 * Group RPC UTC instants by the candidate's display timezone civil date.
 * Does not generate slots. Dates with zero slots are omitted.
 * Civil dates before today in the display timezone are omitted.
 */
export function groupSlotsByDisplayDate(
  slots: UtcBookableSlot[],
  timeZone: string,
  now = new Date(),
): DisplayBookableDay[] {
  const today = isoDateInZone(now, timeZone)
  const map = new Map<string, UtcBookableSlot[]>()

  for (const slot of slots) {
    const start = new Date(slot.startsAtUtc)
    if (Number.isNaN(start.getTime()) || start.getTime() < now.getTime()) continue
    const date = isoDateInZone(start, timeZone)
    if (date < today) continue
    const list = map.get(date) ?? []
    list.push(slot)
    map.set(date, list)
  }

  return [...map.entries()]
    .filter(([, daySlots]) => daySlots.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((a, b) => (a.startsAtUtc < b.startsAtUtc ? -1 : 1)),
    }))
}

export function civilDateForSlot(slot: UtcBookableSlot, timeZone: string) {
  return isoDateInZone(new Date(slot.startsAtUtc), timeZone)
}
