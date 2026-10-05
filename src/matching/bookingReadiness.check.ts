import { preferredDateRangeError } from '../lib/dates.ts'
import { bookingStatusMessage, classifyBookingReadiness } from './bookingReadiness.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const pythonSlot = {
  startsAtUtc: '2026-10-05T04:30:00.000Z',
  endsAtUtc: '2026-10-05T05:30:00.000Z',
}

expect(
  classifyBookingReadiness({
    serviceCount: 0,
    slots: [pythonSlot],
    timezone: 'Asia/Kolkata',
  }) === 'no_service',
  'no service stays a skill match that cannot be booked',
)

expect(
  classifyBookingReadiness({
    serviceCount: 1,
    slots: [],
    timezone: 'Asia/Kolkata',
  }) === 'no_availability',
  'a service without slots is not bookable',
)

expect(
  classifyBookingReadiness({
    serviceCount: 1,
    slots: [pythonSlot],
    timezone: 'Asia/Kolkata',
    preferredDate: '2026-10-01',
    preferredDateEnd: '2026-10-15',
  }) === 'ready',
  'a slot inside the preferred range can be booked',
)

expect(
  classifyBookingReadiness({
    serviceCount: 1,
    slots: [pythonSlot],
    timezone: 'Asia/Kolkata',
    preferredDate: '2026-11-01',
    preferredDateEnd: '2026-11-15',
  }) === 'outside_range',
  'a slot outside the preferred range is hidden from booking',
)

expect(bookingStatusMessage('no_service')?.detail === 'Booking not available yet', 'no-service copy')
expect(bookingStatusMessage('no_availability')?.detail === 'Availability not configured', 'no-availability copy')
expect(bookingStatusMessage('no_service')?.headline === 'Matched by skills', 'skill match stays visible')
expect(bookingStatusMessage('ready') === null, 'ready matches show the book action')
expect(preferredDateRangeError('2026-10-01', '2026-10-15') === null, 'a valid preferred range is accepted')
expect(preferredDateRangeError('2026-10-15', '2026-10-01') !== null, 'an end date before the start is rejected')
expect(preferredDateRangeError('', '') === null, 'an empty range means any day')

console.log('booking readiness checks passed')
