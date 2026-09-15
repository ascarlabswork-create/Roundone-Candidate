import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../availability/index.ts'
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
import {
  PaymentError,
  canConfirmStubPayment,
  confirmStubPayment,
  getCandidatePayment,
  type CandidatePayment,
  type ConfirmStubPaymentResult,
} from '../services/payments.ts'
import { useBookingDraft } from '../state/booking.tsx'

function civilDateLabel(iso: string, timeZone: string) {
  return formatCivilDateWithYear(isoDateInZone(new Date(iso), timeZone))
}

function timeRangeLabel(booking: CandidateBookingView) {
  const zone = booking.displayTimezone
  return `${formatBookingTime(booking.startsAtUtc, zone)} – ${formatBookingTime(booking.endsAtUtc, zone)}`
}

function useHoldCountdown(holdExpiresAt: string | null, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled || !holdExpiresAt) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [enabled, holdExpiresAt])

  return remainingHoldMs(holdExpiresAt, new Date(now))
}

function BookingSummary({ booking }: { booking: CandidateBookingView }) {
  const zone = booking.displayTimezone
  return (
    <div className="mt-6 text-center">
      <div className="flex justify-center">
        <Avatar src={booking.interviewerPhoto ?? ''} name={booking.interviewerName} size="lg" />
      </div>
      <p className="mt-4 text-lg font-semibold text-navy-950">{booking.interviewerName}</p>
      <p className="mt-1 text-slate-600">{booking.serviceName}</p>
      <p className="mt-4 text-base font-medium text-navy-950">{civilDateLabel(booking.startsAtUtc, zone)}</p>
      <p className="text-slate-700">{timeRangeLabel(booking)}</p>
      <p className="mt-1 text-sm text-slate-600">{booking.durationMin} min</p>
      <p className="mt-1 text-xs text-slate-500">{zone}</p>
    </div>
  )
}

function PriceBreakdown({
  sessionFeePaise,
  platformFeePaise,
  totalPaise,
  currency,
}: {
  sessionFeePaise: number
  platformFeePaise: number
  totalPaise: number
  currency: string
}) {
  return (
    <div className="mt-6 space-y-2 rounded-lg bg-slate-50 p-4 text-left text-sm">
      <div className="flex justify-between">
        <span className="text-slate-600">Session fee</span>
        <span className="font-medium text-navy-950">{formatMoneyFromPaise(sessionFeePaise, currency)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-600">Platform fee</span>
        <span className="font-medium text-navy-950">{formatMoneyFromPaise(platformFeePaise, currency)}</span>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-navy-950">
        <span>Total</span>
        <span>{formatMoneyFromPaise(totalPaise, currency)}</span>
      </div>
    </div>
  )
}

type PageData = {
  view: CandidateBookingView
  payment: CandidatePayment | null
}

export function ConfirmationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { draft, updateDraft } = useBookingDraft()
  const bookingId = params.get('bookingId') || draft.createdBookingId
  const [retryNonce, setRetryNonce] = useState(0)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [paid, setPaid] = useState<ConfirmStubPaymentResult | null>(null)
  const payingRef = useRef(false)

  const pageState = useAsync(async (): Promise<PageData> => {
    if (!bookingId) throw new Error('No booking id was provided.')
    const view = await getCandidateBookingView(bookingId)
    let payment: CandidatePayment | null = null
    try {
      payment = await getCandidatePayment(bookingId)
    } catch (error) {
      console.error('getCandidatePayment failed', error)
    }
    return { view, payment }
  }, [bookingId, retryNonce])

  const loaded = pageState.status === 'success' ? pageState.data : null
  const booking =
    paid && loaded
      ? { ...loaded.view, ...paid.booking }
      : loaded?.view ?? null
  const payment = paid?.payment ?? loaded?.payment ?? null

  const holdActive = Boolean(booking && canConfirmStubPayment(booking))
  const remainingMs = useHoldCountdown(booking?.holdExpiresAt ?? null, holdActive)
  const holdExpired =
    Boolean(booking) &&
    (booking?.status === 'expired' ||
      (booking?.status === 'pending_payment' && (isHoldExpired(booking) || remainingMs <= 0)))

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

  async function payAndConfirm() {
    if (!booking || payingRef.current || paying) return
    if (!canConfirmStubPayment(booking) || remainingMs <= 0) return

    payingRef.current = true
    setPaying(true)
    setPayError(null)
    try {
      const result = await confirmStubPayment(booking.id)
      if (result.booking.status === 'requested' || result.payment?.status === 'captured') {
        setPaid(result)
        return
      }
      setPayError('Payment could not be completed.')
    } catch (error) {
      if (error instanceof PaymentError && (error.code === 'already_paid' || error.code === 'hold_expired')) {
        setPaid(null)
        setRetryNonce((value) => value + 1)
        return
      }
      setPayError(error instanceof PaymentError ? error.message : 'Payment could not be completed.')
    } finally {
      payingRef.current = false
      setPaying(false)
    }
  }

  if (!bookingId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState title="Booking not found" body="No booking id was provided." />
      </div>
    )
  }

  if (pageState.status === 'loading' && !paid) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Skeleton className="h-80" />
      </div>
    )
  }

  if ((pageState.status === 'error' || !booking) && !paid) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState
          title="Unable to load booking."
          body={pageState.status === 'error' ? pageState.error : 'We could not find that booking.'}
          retryLabel="Retry"
          onRetry={() => setRetryNonce((value) => value + 1)}
        />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState title="Unable to load booking." body="We could not find that booking." />
      </div>
    )
  }

  const totalPaidPaise = payment?.amountPaise ?? booking.totalPaise
  const currency = payment?.currency ?? booking.currency

  if (booking.status === 'cancelled') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-semibold text-navy-950">Booking cancelled</h1>
          <p className="mt-2 text-sm text-slate-600">This booking is no longer payable.</p>
          <BookingSummary booking={booking} />
          <div className="mt-8">
            <Link to="/candidate/interviews">
              <Button>View Booking</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (holdExpired) {
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

  if (booking.status === 'requested' || payment?.status === 'captured') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-semibold text-navy-950">Payment successful</h1>
          <p className="mt-2 text-sm text-slate-600">Booking request sent to interviewer</p>
          <BookingSummary booking={booking} />
          <dl className="mt-6 space-y-2 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Booking ID</dt>
              <dd className="font-medium text-navy-950 break-all">{booking.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Interviewer</dt>
              <dd className="font-medium text-navy-950">{booking.interviewerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Service</dt>
              <dd className="font-medium text-navy-950">{booking.serviceName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Date</dt>
              <dd className="font-medium text-navy-950">{civilDateLabel(booking.startsAtUtc, booking.displayTimezone)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Time</dt>
              <dd className="font-medium text-navy-950">{timeRangeLabel(booking)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Total paid</dt>
              <dd className="font-semibold text-navy-950">{formatMoneyFromPaise(totalPaidPaise, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Booking status</dt>
              <dd className="font-medium text-navy-950">Awaiting interviewer confirmation</dd>
            </div>
          </dl>
          <div className="mt-8">
            <Link to="/candidate/interviews">
              <Button fullWidth>View Booking</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const payable = canConfirmStubPayment(booking) && remainingMs > 0 && !paying

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-semibold text-navy-950">Complete your payment</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your slot is held while you pay. Payment success sends a request to the interviewer — it is not a confirmed interview yet.
        </p>
        <BookingSummary booking={booking} />
        <PriceBreakdown
          sessionFeePaise={booking.sessionFeePaise}
          platformFeePaise={booking.platformFeePaise}
          totalPaise={booking.totalPaise}
          currency={booking.currency}
        />

        <dl className="mt-6 space-y-2 text-left text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Payment status</dt>
            <dd className="font-medium text-navy-950">Payment required</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Hold</dt>
            <dd className="font-medium text-navy-950">10-minute booking hold</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Countdown</dt>
            <dd className="font-semibold text-navy-950">{formatHoldCountdown(remainingMs)}</dd>
          </div>
        </dl>

        {payError ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
            <p className="text-sm font-semibold text-red-800">Payment could not be completed.</p>
            <p className="mt-1 text-sm text-red-700">{payError}</p>
          </div>
        ) : null}

        <div className="mt-8">
          <Button fullWidth disabled={!payable} onClick={() => void payAndConfirm()}>
            {paying ? 'Processing…' : payError ? 'Retry Payment' : 'Pay & Confirm'}
          </Button>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          This MVP uses a stub payment. No card is charged. A future payment provider can replace this step without changing booking status rules.
        </p>
      </Card>
    </div>
  )
}
