import { formatMoneyFromPaise } from '../lib/format.ts'
import {
  formatHoldCountdown,
  isHoldExpired,
  mapBookingError,
  parseCandidateBooking,
  remainingHoldMs,
  sameHeldSlot,
  validateCreateBookingInput,
} from './bookingModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runBookingModelChecks() {
  expect(
    validateCreateBookingInput({
      serviceId: 'not-a-uuid',
      startsAtUtc: '2026-09-12T13:30:00.000Z',
      displayTimezone: 'Asia/Kolkata',
    }) !== null,
    'D: invalid service must fail validation',
  )
  expect(
    validateCreateBookingInput({
      serviceId: '00000000-0000-4000-8000-000000000011',
      startsAtUtc: '',
      displayTimezone: 'Asia/Kolkata',
    }) === 'Select a date and time before confirming.',
    'Missing start time must fail validation',
  )

  const slotTaken = mapBookingError({ message: 'slot_unavailable', code: 'P0001' })
  expect(slotTaken.code === 'slot_unavailable', 'B: slot conflict maps to slot_unavailable')
  expect(slotTaken.message === 'This slot was just taken.', 'B: slot conflict uses the candidate message')
  expect(mapBookingError({ message: 'not_authenticated' }).code === 'unauthenticated', 'C: unauthenticated maps cleanly')
  expect(mapBookingError({ message: 'service_not_found' }).code === 'invalid_service', 'D: invalid service maps cleanly')
  expect(!mapBookingError({ message: 'duplicate key value' }).message.toLowerCase().includes('duplicate key'), 'Raw postgres text is not shown')

  const now = new Date('2026-09-12T13:00:00.000Z')
  expect(formatHoldCountdown(9 * 60_000 + 59_000) === '09:59', 'E: countdown formats remaining hold time')
  expect(remainingHoldMs('2026-09-12T13:00:00.000Z', now) === 0, 'E: hold at expiry is zero')
  expect(
    isHoldExpired(
      { status: 'pending_payment', holdExpiresAt: '2026-09-12T12:59:00.000Z' },
      now,
    ),
    'E: pending_payment past hold_expires_at is expired in the UI',
  )
  expect(
    !isHoldExpired(
      { status: 'pending_payment', holdExpiresAt: '2026-09-12T13:10:00.000Z' },
      now,
    ),
    'Active hold is not expired',
  )

  const parsed = parseCandidateBooking({
    id: '00000000-0000-4000-8000-000000000021',
    candidate_profile_id: '00000000-0000-4000-8000-000000000022',
    interviewer_profile_id: '00000000-0000-4000-8000-000000000023',
    service_id: '00000000-0000-4000-8000-000000000024',
    status: 'pending_payment',
    starts_at: '2026-09-12T13:30:00+00:00',
    ends_at: '2026-09-12T14:30:00+00:00',
    display_timezone: 'Asia/Kolkata',
    duration_min: 60,
    session_fee_paise: 150000,
    platform_fee_paise: 7500,
    total_paise: 157500,
    currency: 'INR',
    hold_expires_at: '2027-09-12T13:40:00+00:00',
    mode: 'video',
  })
  expect(Boolean(parsed), 'Created booking row must parse')
  expect(parsed?.status === 'pending_payment', 'Status is pending_payment')
  expect(parsed?.totalPaise === 157500, 'F: UI must keep the server total')
  const money = formatMoneyFromPaise(parsed?.totalPaise ?? 0, parsed?.currency ?? 'INR')
  expect(money.includes('1,575') || money.includes('1575'), `F: server paise is displayed, got ${money}`)
  expect(
    sameHeldSlot(parsed!, {
      serviceId: parsed!.serviceId,
      startsAtUtc: parsed!.startsAtUtc,
      displayTimezone: parsed!.displayTimezone,
    }),
    'H: the same held slot can be reused instead of creating a duplicate',
  )
  expect(
    !sameHeldSlot(parsed!, {
      serviceId: parsed!.serviceId,
      startsAtUtc: '2026-09-12T15:30:00.000Z',
      displayTimezone: parsed!.displayTimezone,
    }),
    'A different slot is not treated as the same hold',
  )

  return true
}

runBookingModelChecks()
console.log('booking model checks passed')
