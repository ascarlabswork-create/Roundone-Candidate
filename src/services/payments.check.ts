import { isHoldExpired } from './bookingModel.ts'
import {
  canConfirmStubPayment,
  isAlreadyPaid,
  mapPaymentError,
  parseCandidatePayment,
} from './paymentModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runPaymentModelChecks() {
  const now = new Date('2026-09-12T13:00:00.000Z')

  expect(
    canConfirmStubPayment(
      { status: 'pending_payment', holdExpiresAt: '2026-09-12T13:10:00.000Z' },
      now,
    ),
    'A: pending_payment with an active hold is payable',
  )
  expect(
    !canConfirmStubPayment(
      { status: 'pending_payment', holdExpiresAt: '2026-09-12T12:59:00.000Z' },
      now,
    ),
    'B: hold expired disables confirm_stub_payment',
  )
  expect(
    isHoldExpired({ status: 'pending_payment', holdExpiresAt: '2026-09-12T12:59:00.000Z' }, now),
    'B: pending_payment past hold_expires_at is expired',
  )
  expect(
    !canConfirmStubPayment({ status: 'requested', holdExpiresAt: '2026-09-12T13:10:00.000Z' }, now),
    'D: requested bookings must not call confirm_stub_payment again',
  )
  expect(
    !canConfirmStubPayment({ status: 'expired', holdExpiresAt: '2026-09-12T12:50:00.000Z' }, now),
    'Expired status is not payable',
  )
  expect(
    !canConfirmStubPayment({ status: 'cancelled', holdExpiresAt: null }, now),
    'Cancelled bookings are not payable',
  )

  expect(
    isAlreadyPaid({ status: 'requested' }, { status: 'created' }),
    'D: requested booking is already paid from the candidate UI',
  )
  expect(
    isAlreadyPaid({ status: 'pending_payment' }, { status: 'captured' }),
    'D: captured payment is already paid',
  )
  expect(
    !isAlreadyPaid({ status: 'pending_payment' }, { status: 'created' }),
    'Unpaid pending_payment is not already paid',
  )

  const holdExpired = mapPaymentError({ message: 'hold_expired', code: 'P0001' })
  expect(holdExpired.code === 'hold_expired', 'Hold expiry maps to hold_expired')
  expect(holdExpired.message === 'Payment hold expired', 'Hold expiry uses the candidate message')
  expect(mapPaymentError({ message: 'slot_unavailable' }).message === 'Slot no longer available', 'Slot errors stay user-friendly')
  expect(mapPaymentError({ message: 'invalid_status' }).message === 'Booking no longer payable', 'Invalid status stays user-friendly')
  expect(mapPaymentError({ message: 'not_authenticated' }).message === 'Authentication required', 'Auth errors stay user-friendly')
  expect(mapPaymentError({ message: 'failed to fetch' }).message === 'Temporary payment error', 'Network errors stay user-friendly')
  expect(mapPaymentError({ message: 'duplicate key value' }).message === 'Payment could not be completed.', 'E: raw postgres text is not shown')
  expect(!mapPaymentError({ message: 'duplicate key value' }).message.toLowerCase().includes('duplicate key'), 'Raw postgres text is not shown')

  const parsed = parseCandidatePayment({
    id: '00000000-0000-4000-8000-000000000031',
    booking_id: '00000000-0000-4000-8000-000000000021',
    amount_paise: 157500,
    platform_fee_paise: 7500,
    currency: 'INR',
    status: 'created',
    created_at: '2026-09-12T13:00:00+00:00',
    provider: 'stub',
    provider_ref: 'secret-ref',
  })
  expect(Boolean(parsed), 'Payment row must parse')
  expect(parsed?.amountPaise === 157500, 'Candidate payment uses server amount_paise')
  expect(parsed?.status === 'created', 'Payment status is read from the server')
  expect(!('provider' in (parsed ?? {})), 'Provider internals are not exposed on the parsed payment')
  expect(!('providerRef' in (parsed ?? {})), 'Provider refs are not exposed on the parsed payment')

  return true
}

runPaymentModelChecks()
console.log('payment model checks passed')
