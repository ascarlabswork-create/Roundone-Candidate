import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatBookingTime, isoDateInZone } from '../availability/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { Avatar } from '../components/ui/identity.tsx'
import { formatMoneyFromPaise } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  formatHoldCountdown,
  getCandidateBookingView,
  isHoldExpired,
  remainingHoldMs,
  type CandidateBookingView,
} from '../services/bookings.ts'
import { useBookingDraft } from '../state/booking.tsx'
import type { PaymentMethod } from '../types.ts'

const PAYMENT_METHODS: Array<[PaymentMethod, string]> = [
  ['upi', 'UPI'],
  ['card', 'Card'],
  ['netbanking', 'Net Banking'],
  ['wallet', 'Wallet'],
]

function weekdayInZone(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone })
}

function useHoldCountdown(holdExpiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!holdExpiresAt) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [holdExpiresAt])

  return remainingHoldMs(holdExpiresAt, new Date(now))
}

function BookingSummary({ booking }: { booking: CandidateBookingView }) {
  const zone = booking.displayTimezone
  return (
    <div className="mt-6 text-center">
      <div className="flex justify-center">
        <Avatar src={booking.interviewerPhoto ?? ''} name={booking.interviewerName} size="lg" />
      </div>
      <p className="mt-4 text-lg font-semibold text-navy-950">{booking.serviceName}</p>
      <p className="mt-1 text-slate-600">{booking.interviewerName}</p>
      <p className="mt-4 text-base font-medium text-navy-950">{weekdayInZone(booking.startsAtUtc, zone)}</p>
      <p className="text-slate-700">
        {formatBookingTime(booking.startsAtUtc, zone)} - {formatBookingTime(booking.endsAtUtc, zone)}
      </p>
      <p className="mt-1 text-xs text-slate-500">{zone}</p>
    </div>
  )
}

export function ConfirmationPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { draft, updateDraft } = useBookingDraft()
  const bookingId = params.get('bookingId') || draft.createdBookingId
  const showPayment = params.get('pay') === '1'
  const [paymentNotice, setPaymentNotice] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  const bookingState = useAsync(
    () => (bookingId ? getCandidateBookingView(bookingId) : Promise.reject(new Error('No booking id was provided.'))),
    [bookingId, retryNonce],
  )

  const booking = bookingState.status === 'success' ? bookingState.data : null
  const remainingMs = useHoldCountdown(booking?.holdExpiresAt ?? null)
  const expired = booking ? isHoldExpired(booking) || remainingMs <= 0 : false

  function openPayment() {
    const copy = new URLSearchParams(params)
    if (bookingId) copy.set('bookingId', bookingId)
    copy.set('pay', '1')
    setParams(copy)
    setPaymentNotice('')
  }

  function chooseAnotherSlot() {
    const interviewerId = booking?.interviewerProfileId || draft.interviewerProfileId || draft.interviewerId
    updateDraft({
      slotId: '',
      selectedDate: '',
      selectedSlot: '',
      startsAtUtc: '',
      endsAtUtc: '',
      createdBookingId: '',
    })
    if (interviewerId) {
      navigate(`/candidate/interviewers/${interviewerId}/book?step=2`)
      return
    }
    navigate('/candidate/interviewers')
  }

  if (!bookingId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState title="Booking not found" body="No booking id was provided." />
      </div>
    )
  }

  if (bookingState.status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (bookingState.status === 'error' || !booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState
          title="Unable to load booking."
          body={bookingState.status === 'error' ? bookingState.error : 'We could not find that booking.'}
          retryLabel="Retry"
          onRetry={() => setRetryNonce((value) => value + 1)}
        />
      </div>
    )
  }

  if (expired) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-semibold text-navy-950">Your booking hold has expired.</h1>
          <p className="mt-2 text-sm text-slate-600">
            This slot is no longer reserved. Choose another available time to continue.
          </p>
          <BookingSummary booking={booking} />
          <div className="mt-8">
            <Button onClick={chooseAnotherSlot}>Choose another slot</Button>
          </div>
        </Card>
      </div>
    )
  }

  const statusLabel = booking.status === 'pending_payment' ? 'Payment pending' : booking.status
  const civilDate = isoDateInZone(new Date(booking.startsAtUtc), booking.displayTimezone)

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-semibold text-navy-950">Your slot is temporarily held</h1>
        <p className="mt-2 text-sm text-slate-600">
          Complete payment before the hold expires. No charge is taken in this step.
        </p>
        <BookingSummary booking={booking} />
        <p className="sr-only">{civilDate}</p>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Booking status</dt>
            <dd className="font-medium text-navy-950">{statusLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Hold expires in</dt>
            <dd className="font-semibold text-navy-950">{formatHoldCountdown(remainingMs)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Duration</dt>
            <dd className="font-medium text-navy-950">{booking.durationMin} min</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Session fee</dt>
            <dd className="font-medium text-navy-950">
              {formatMoneyFromPaise(booking.sessionFeePaise, booking.currency)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Platform fee</dt>
            <dd className="font-medium text-navy-950">
              {formatMoneyFromPaise(booking.platformFeePaise, booking.currency)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-navy-950">
            <dt>Total</dt>
            <dd>{formatMoneyFromPaise(booking.totalPaise, booking.currency)}</dd>
          </div>
        </dl>

        {!showPayment ? (
          <div className="mt-8">
            <Button fullWidth onClick={openPayment}>
              Continue to Payment
            </Button>
          </div>
        ) : (
          <div className="mt-8 text-left">
            <h2 className="text-sm font-semibold text-navy-950">Payment method</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(([methodId, label]) => (
                <button
                  key={methodId}
                  type="button"
                  onClick={() => updateDraft({ paymentMethod: methodId })}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    draft.paymentMethod === methodId ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span>Session fee</span>
                <span>{formatMoneyFromPaise(booking.sessionFeePaise, booking.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee</span>
                <span>{formatMoneyFromPaise(booking.platformFeePaise, booking.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-navy-950">
                <span>Total</span>
                <span>{formatMoneyFromPaise(booking.totalPaise, booking.currency)}</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Payment is mocked. Your real booking stays in payment pending until a later payment layer.
            </p>
            {paymentNotice ? <p className="mt-3 text-sm text-navy-800">{paymentNotice}</p> : null}
            <Button
              className="mt-4"
              fullWidth
              onClick={() =>
                setPaymentNotice(
                  'Payment is not processed yet. Your slot remains held until the timer expires.',
                )
              }
            >
              Pay {formatMoneyFromPaise(booking.totalPaise, booking.currency)}
            </Button>
          </div>
        )}

        <div className="mt-6">
          <Link to="/candidate/interviews" className="text-sm font-medium text-blue-700">
            View My Interviews
          </Link>
        </div>
      </Card>
    </div>
  )
}
