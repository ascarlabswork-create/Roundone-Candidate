import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  BookingError,
  getCandidateBooking,
  parseCandidateBooking,
  type CandidateBooking,
} from './bookings.ts'
import {
  PaymentError,
  canConfirmStubPayment,
  isAlreadyPaid,
  mapPaymentError,
  parseCandidatePayment,
  type CandidatePayment,
  type ConfirmStubPaymentResult,
} from './paymentModel.ts'

export type { CandidatePayment, ConfirmStubPaymentResult } from './paymentModel.ts'
export {
  PaymentError,
  canConfirmStubPayment,
  isAlreadyPaid,
  isPaymentCaptured,
  mapPaymentError,
  parseCandidatePayment,
} from './paymentModel.ts'

/** Candidate-readable payment columns. Never select provider, provider_ref, or payout fields. */
const PAYMENT_SELECT = 'id, booking_id, amount_paise, platform_fee_paise, currency, status, created_at'

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new PaymentError('unauthenticated', 'Authentication required')
  }
  return data.user
}

export async function getCandidatePayment(bookingId: string): Promise<CandidatePayment | null> {
  await requireAuthenticatedUser()
  if (!isUuid(bookingId)) {
    throw new PaymentError('not_found', 'We could not find that booking.')
  }

  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_SELECT)
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('getCandidatePayment failed', error)
    throw mapPaymentError(error)
  }

  if (!data) return null
  const payment = parseCandidatePayment(data)
  if (!payment) {
    throw new PaymentError('rpc', 'Unable to load payment details. Please try again.')
  }
  return payment
}

async function loadPayableState(bookingId: string): Promise<{
  booking: CandidateBooking
  payment: CandidatePayment | null
}> {
  let booking: CandidateBooking
  try {
    booking = await getCandidateBooking(bookingId)
  } catch (error) {
    if (error instanceof BookingError && error.code === 'unauthenticated') {
      throw new PaymentError('unauthenticated', 'Authentication required')
    }
    if (error instanceof BookingError && error.code === 'not_found') {
      throw new PaymentError('not_found', 'We could not find that booking.')
    }
    throw mapPaymentError(error)
  }

  const payment = await getCandidatePayment(bookingId)
  return { booking, payment }
}

/**
 * Capture the stub payment for a held booking.
 * Never writes bookings.status or payments.status from the client — confirm_stub_payment is the source of truth.
 * If the booking is already requested / captured, reloads server state and does not call the RPC again.
 */
export async function confirmStubPayment(bookingId: string): Promise<ConfirmStubPaymentResult> {
  await requireAuthenticatedUser()
  if (!isUuid(bookingId)) {
    throw new PaymentError('not_found', 'We could not find that booking.')
  }

  const current = await loadPayableState(bookingId)

  if (isAlreadyPaid(current.booking, current.payment)) {
    return { ...current, rpcCalled: false }
  }

  if (current.booking.status === 'expired' || current.booking.status === 'cancelled') {
    throw current.booking.status === 'expired'
      ? new PaymentError('hold_expired', 'Payment hold expired')
      : new PaymentError('not_payable', 'Booking no longer payable')
  }

  if (!canConfirmStubPayment(current.booking)) {
    throw new PaymentError('hold_expired', 'Payment hold expired')
  }

  const { data, error } = await supabase.rpc('confirm_stub_payment', {
    p_booking_id: bookingId,
  })

  if (error) {
    console.error('confirm_stub_payment failed', error)
    const mapped = mapPaymentError(error)
    if (mapped.code === 'not_payable' || mapped.code === 'already_paid' || mapped.code === 'hold_expired') {
      const latest = await loadPayableState(bookingId)
      if (isAlreadyPaid(latest.booking, latest.payment)) {
        return { ...latest, rpcCalled: false }
      }
      if (latest.booking.status === 'expired' || !canConfirmStubPayment(latest.booking)) {
        throw new PaymentError('hold_expired', 'Payment hold expired')
      }
    }
    throw mapped
  }

  const booking = parseCandidateBooking(data)
  if (!booking) {
    throw new PaymentError('rpc', 'Payment could not be completed.')
  }

  let payment: CandidatePayment | null = null
  try {
    payment = await getCandidatePayment(bookingId)
  } catch (paymentError) {
    console.error('getCandidatePayment after confirm_stub_payment failed', paymentError)
  }

  if (booking.status !== 'requested' && !isAlreadyPaid(booking, payment)) {
    throw new PaymentError('rpc', 'Payment could not be completed.')
  }

  return { booking, payment, rpcCalled: true }
}
