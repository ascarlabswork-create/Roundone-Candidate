import { formatBookingTime } from '../availability/timezone.ts'
import {
  getBookableWindow,
  groupSlotsByDisplayDate,
  parseBookableSlotRows,
  toUtcIso,
  type UtcBookableSlot,
} from './bookableSlots.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runBookableSlotChecks() {
  const emptyDays = groupSlotsByDisplayDate([], 'Asia/Kolkata', new Date('2026-09-12T04:00:00.000Z'))
  expect(emptyDays.length === 0, 'A: no slots must produce no date cards')

  const saturdayMorningUtc = '2026-09-12T04:30:00.000Z' // 10:00 AM IST
  const saturdayNoonUtc = '2026-09-12T06:30:00.000Z' // 12:00 PM IST
  const slots: UtcBookableSlot[] = [
    { startsAtUtc: saturdayMorningUtc, endsAtUtc: '2026-09-12T05:30:00.000Z' },
    { startsAtUtc: saturdayNoonUtc, endsAtUtc: '2026-09-12T07:30:00.000Z' },
  ]

  const istDays = groupSlotsByDisplayDate(slots, 'Asia/Kolkata', new Date('2026-09-11T00:00:00.000Z'))
  expect(istDays.length === 1, 'IST should produce a single Saturday card')
  expect(istDays[0]?.date === '2026-09-12', 'IST civil date should be 12 September')
  expect(istDays[0]?.slots.length === 2, 'Both RPC slots should appear on Saturday IST')
  expect(formatBookingTime(saturdayMorningUtc, 'Asia/Kolkata') === '10:00 AM', 'IST display should be 10:00 AM')

  const nycDays = groupSlotsByDisplayDate(slots, 'America/New_York', new Date('2026-09-11T00:00:00.000Z'))
  expect(nycDays.length === 1, 'NYC should still have a date card')
  expect(nycDays[0]?.date === '2026-09-12', 'NYC civil date should remain 12 September for 00:30 local')
  expect(formatBookingTime(saturdayMorningUtc, 'America/New_York') === '12:30 AM', 'NYC display should change')
  expect(nycDays[0]?.slots[0]?.startsAtUtc === saturdayMorningUtc, 'H: stored UTC must not change with timezone')

  const past = groupSlotsByDisplayDate(slots, 'Asia/Kolkata', new Date('2026-09-13T00:00:00.000Z'))
  expect(past.length === 0, 'Past civil dates must not appear')

  const parsed = parseBookableSlotRows([
    { starts_at: '2026-09-12T04:30:00+00:00', ends_at: '2026-09-12T05:30:00+00:00' },
    { starts_at: 'bad', ends_at: 'also-bad' },
  ])
  expect(parsed.length === 1, 'Invalid RPC rows must be skipped')
  expect(parsed[0]?.startsAtUtc === '2026-09-12T04:30:00.000Z', 'Parsed timestamps must be stored as UTC ISO')
  expect(toUtcIso(parsed[0]?.startsAtUtc) === parsed[0]?.startsAtUtc, 'UTC ISO must round-trip unchanged')

  const window = getBookableWindow(0, new Date('2026-09-12T00:00:00.000Z'))
  expect(window.to.getTime() - window.from.getTime() === 14 * 24 * 60 * 60 * 1000, 'MVP window is 14 days')

  return true
}

runBookableSlotChecks()
console.log('bookable slot checks passed')
