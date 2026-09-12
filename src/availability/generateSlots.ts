import type { BookableDay, BookableSlot, OccupiedInterval, SlotGenerationInput } from './types.ts'
import {
  addCivilDays,
  isoDateInZone,
  wallTimeInZoneToUtc,
  weekdayOfCivilDate,
} from './timezone.ts'

const DEFAULT_HORIZON_DAYS = 28

function slotId(interviewerId: string, startISO: string, durationMin: number) {
  return `slot:${interviewerId}:${startISO}:${durationMin}`
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd
}

type Window = { start: Date; end: Date }

function windowsForDate(input: SlotGenerationInput, dateISO: string): Window[] {
  const { availability } = input
  const tz = availability.timezone
  const weekday = weekdayOfCivilDate(dateISO)
  const windows: Window[] = []

  for (const rule of availability.recurring) {
    if (rule.day !== weekday) continue
    windows.push({
      start: wallTimeInZoneToUtc(dateISO, rule.startTime, tz),
      end: wallTimeInZoneToUtc(dateISO, rule.endTime, tz),
    })
  }

  for (const extra of availability.custom) {
    if (extra.date !== dateISO) continue
    windows.push({
      start: wallTimeInZoneToUtc(dateISO, extra.startTime, tz),
      end: wallTimeInZoneToUtc(dateISO, extra.endTime, tz),
    })
  }

  return windows
}

function blockedWindowsForDate(input: SlotGenerationInput, dateISO: string): Window[] {
  const tz = input.availability.timezone
  return input.availability.blocked
    .filter((item) => item.date === dateISO)
    .map((item) => {
      if (item.allDay || !item.startTime || !item.endTime) {
        return {
          start: wallTimeInZoneToUtc(dateISO, '00:00', tz),
          end: wallTimeInZoneToUtc(addCivilDays(dateISO, 1), '00:00', tz),
        }
      }
      return {
        start: wallTimeInZoneToUtc(dateISO, item.startTime, tz),
        end: wallTimeInZoneToUtc(dateISO, item.endTime, tz),
      }
    })
}

function subtractBlocked(windows: Window[], blocked: Window[]) {
  let remaining = [...windows]
  for (const block of blocked) {
    const next: Window[] = []
    for (const window of remaining) {
      if (!overlaps(window.start.getTime(), window.end.getTime(), block.start.getTime(), block.end.getTime())) {
        next.push(window)
        continue
      }
      if (window.start < block.start) {
        next.push({ start: window.start, end: block.start < window.end ? block.start : window.end })
      }
      if (window.end > block.end) {
        next.push({ start: block.end > window.start ? block.end : window.start, end: window.end })
      }
    }
    remaining = next.filter((item) => item.end.getTime() - item.start.getTime() > 0)
  }
  return remaining
}

function occupiedRanges(occupied: OccupiedInterval[], bufferMin: number) {
  return occupied.map((item) => ({
    start: new Date(item.start).getTime(),
    end: new Date(item.end).getTime() + bufferMin * 60_000,
  }))
}

/**
 * Availability engine: interviewer rules + service duration + bookings + blocks + buffer.
 * Returns UTC bookable slots only. Candidate UI must not invent times.
 */
export function generateBookableSlots(input: SlotGenerationInput): BookableSlot[] {
  const durationMin = input.durationMin
  if (durationMin <= 0) return []

  const from = input.from ?? new Date()
  const horizonDays = input.horizonDays ?? DEFAULT_HORIZON_DAYS
  const tz = input.availability.timezone
  const today = isoDateInZone(from, tz)
  const occupied = occupiedRanges(input.occupied, input.availability.bookingBufferMin)
  const stepMs = durationMin * 60_000
  const slots: BookableSlot[] = []

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const dateISO = addCivilDays(today, offset)
    const open = subtractBlocked(windowsForDate(input, dateISO), blockedWindowsForDate(input, dateISO))

    for (const window of open) {
      for (let startMs = window.start.getTime(); startMs + stepMs <= window.end.getTime(); startMs += stepMs) {
        const endMs = startMs + stepMs
        if (startMs < from.getTime()) continue
        const busy = occupied.some((item) => overlaps(startMs, endMs, item.start, item.end))
        if (busy) continue
        const start = new Date(startMs).toISOString()
        slots.push({
          id: slotId(input.interviewerId, start, durationMin),
          start,
          end: new Date(endMs).toISOString(),
          durationMin,
        })
      }
    }
  }

  return slots.sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

export function groupSlotsByDate(slots: BookableSlot[], displayTimeZone: string): BookableDay[] {
  const map = new Map<string, BookableSlot[]>()
  for (const slot of slots) {
    const date = isoDateInZone(new Date(slot.start), displayTimeZone)
    const list = map.get(date) ?? []
    list.push(slot)
    map.set(date, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => ({ date, slots: daySlots }))
}

export function findBookableSlot(slots: BookableSlot[], slotId: string) {
  return slots.find((item) => item.id === slotId) ?? null
}
