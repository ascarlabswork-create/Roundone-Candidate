import { asRecord, readNumber, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'
import { isHoldExpired, type CandidateBooking } from './bookingModel.ts'

export type PaymentErrorCode =
  | 'unauthenticated'
  | 'hold_expired'
  | 'slot_unavailable'
  | 'already_paid'
  | 'not_payable'
  | 'not_found'
  | 'network'
  | 'rpc'

export class PaymentError extends Error {
  readonly code: PaymentErrorCode

  constructor(code: PaymentErrorCode, message: string) {
    super(message)
    this.name = 'PaymentError'
    this.code = code
  }
}

/** Candidate-visible payment fields only. Provider internals are never parsed here. */
export type CandidatePayment = {
  id: string
  bookingId: string
  amountPaise: number
  platformFeePaise: number
  currency: string
  status: string
  createdAt: string
}

export type ConfirmStubPaymentResult = {
  booking: CandidateBooking
  payment: CandidatePayment | null
  rpcCalled: boolean
}

function errorText(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const record = error as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  const details = typeof record.details === 'string' ? record.details : ''
  const code = typeof record.code === 'string' ? record.code : ''
  return `${code} ${message} ${details}`.toLowerCase()
}

export function mapPaymentError(error: unknown): PaymentError {
  const text = errorText(error)
  const rawMessage = error instanceof Error ? error.message : ''
  const combined = `${text} ${rawMessage.toLowerCase()}`

  if (
    combined.includes('not_authenticated') ||
    combined.includes('not_authorized') ||
    combined.includes('not_a_candidate') ||
    combined.includes('auth session missing') ||
    combined.includes('jwt') ||
    rawMessage.toLowerCase().includes('sign in')
  ) {
    return new PaymentError('unauthenticated', 'Authentication required')
  }
  if (combined.includes('hold_expired')) {
    return new PaymentError('hold_expired', 'Payment hold expired')
  }
  if (
    combined.includes('slot_unavailable') ||
    combined.includes('23p01') ||
    combined.includes('exclusion') ||
    combined.includes('overlap')
  ) {
    return new PaymentError('slot_unavailable', 'Slot no longer available')
  }
  if (combined.includes('already_captured') || combined.includes('payment already completed')) {
    return new PaymentError('already_paid', 'Payment already completed')
  }
  if (
    combined.includes('invalid_status') ||
    combined.includes('booking_not_found') ||
    combined.includes('cancelled')
  ) {
    return new PaymentError('not_payable', 'Booking no longer payable')
  }
  if (
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    rawMessage.toLowerCase().includes('network')
  ) {
    return new PaymentError('network', 'Temporary payment error')
  }
  return new PaymentError('rpc', 'Payment could not be completed.')
}

export function parseCandidatePayment(value: unknown): CandidatePayment | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const bookingId = readString(row, 'booking_id')
  const amountPaise = readNumber(row, 'amount_paise')
  const platformFeePaise = readNumber(row, 'platform_fee_paise')
  const currency = readString(row, 'currency')
  const status = readString(row, 'status')
  const createdAt = readString(row, 'created_at')
  if (
    !id ||
    !bookingId ||
    amountPaise === null ||
    platformFeePaise === null ||
    !currency ||
    !status ||
    !createdAt
  ) {
    return null
  }
  return {
    id,
    bookingId,
    amountPaise,
    platformFeePaise,
    currency,
    status,
    createdAt,
  }
}

export function isPaymentCaptured(payment: Pick<CandidatePayment, 'status'> | null | undefined) {
  return payment?.status === 'captured'
}

export function isAlreadyPaid(
  booking: Pick<CandidateBooking, 'status'>,
  payment?: Pick<CandidatePayment, 'status'> | null,
) {
  return booking.status === 'requested' || isPaymentCaptured(payment)
}

/** True only when the client may call confirm_stub_payment. The RPC is still authoritative. */
export function canConfirmStubPayment(
  booking: Pick<CandidateBooking, 'status' | 'holdExpiresAt'>,
  now = new Date(),
) {
  if (booking.status !== 'pending_payment') return false
  return !isHoldExpired(booking, now)
}

export function validatePaymentBookingId(bookingId: string): string | null {
  if (!isUuid(bookingId)) return 'We could not find that booking.'
  return null
}
