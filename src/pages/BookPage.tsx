import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createBooking, getInterviewer, platformFeeFor } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, FieldLabel, SelectInput, Skeleton } from '../components/ui/primitives.tsx'
import { Avatar, VerifiedBadge } from '../components/ui/identity.tsx'
import { TIMEZONES } from '../data/catalogs.ts'
import { formatDateLong, formatTime, toISODate } from '../lib/dates.ts'
import { formatINR } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { isVerified } from '../data/interviewers.ts'
import { useBookingDraft } from '../state/booking.tsx'
import type { PaymentMethod } from '../types.ts'

const steps = ['Select Service', 'Choose Date & Time', 'Review & Pay'] as const

export function BookPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const interviewerState = useAsync(() => getInterviewer(id), [id])
  const { draft, updateDraft, resetDraft } = useBookingDraft()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  const step = Number(params.get('step') ?? '1') as 1 | 2 | 3
  const preselectedService = params.get('service')

  useEffect(() => {
    if (draft.interviewerId !== id) resetDraft(id)
  }, [draft.interviewerId, id, resetDraft])

  useEffect(() => {
    if (preselectedService && draft.serviceId !== preselectedService) {
      updateDraft({ serviceId: preselectedService })
    }
  }, [preselectedService, draft.serviceId, updateDraft])

  const interviewer = interviewerState.status === 'success' ? interviewerState.data : null
  const service = interviewer?.services.find((item) => item.id === draft.serviceId)
  const slot = interviewer?.availability.find((item) => item.id === draft.slotId)
  const sessionFee = service?.price ?? 0
  const platformFee = sessionFee ? platformFeeFor(sessionFee) : 0

  const days = useMemo(() => {
    if (!interviewer) return []
    const map = new Map<string, typeof interviewer.availability>()
    for (const item of interviewer.availability) {
      const key = toISODate(new Date(item.start))
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [interviewer])

  const [selectedDay, setSelectedDay] = useState('')
  const activeDay = selectedDay || days[0]?.[0] || ''
  const visibleSlots = days.find(([key]) => key === activeDay)?.[1] ?? []

  function go(next: number) {
    const copy = new URLSearchParams(params)
    copy.set('step', String(next))
    setParams(copy)
  }

  async function pay() {
    if (!service || !slot) return
    setPaying(true)
    setError('')
    try {
      const booking = await createBooking(draft, draft.paymentMethod)
      navigate(`/candidate/booking/confirmation?bookingId=${booking.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  if (interviewerState.status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-80" />
      </div>
    )
  }
  if (interviewerState.status === 'error' || !interviewer) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <ErrorState body={interviewerState.status === 'error' ? interviewerState.error : 'Not found'} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to={`/candidate/interviewers/${interviewer.id}`} className="text-sm font-medium text-blue-700">
        ← Back to profile
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-navy-950">Book your interview</h1>

      <ol className="mt-6 grid grid-cols-3 gap-2 text-sm">
        {steps.map((label, index) => {
          const n = index + 1
          const active = step === n
          const done = step > n
          return (
            <li
              key={label}
              className={`rounded-lg border px-3 py-2 ${
                active
                  ? 'border-navy-950 bg-navy-950 text-white'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <span className="font-semibold">Step {n}</span>
              <span className="mt-0.5 block">{label}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="p-5 sm:p-6">
          {step === 1 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-navy-950">Select a service</h2>
              {interviewer.services.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updateDraft({ serviceId: item.id })}
                  className={`w-full rounded-xl border p-4 text-left ${
                    draft.serviceId === item.id ? 'border-navy-950 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy-950">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.durationMin} min · {item.interviewType}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                    </div>
                    <p className="font-semibold text-navy-950">{formatINR(item.price)}</p>
                  </div>
                </button>
              ))}
              <Button className="mt-4" disabled={!draft.serviceId} onClick={() => go(2)} fullWidth>
                Continue
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Choose date & time</h2>
              <div className="mt-4">
                <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                <SelectInput
                  id="timezone"
                  value={draft.timezone}
                  onChange={(event) => updateDraft({ timezone: event.target.value })}
                >
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {days.map(([day]) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`min-w-24 rounded-lg border px-3 py-2 text-sm ${
                      activeDay === day ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-200'
                    }`}
                  >
                    {formatDateLong(`${day}T12:00:00`)}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {visibleSlots.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateDraft({ slotId: item.id })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      draft.slotId === item.id ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-200'
                    }`}
                  >
                    {formatTime(item.start)}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Duration: {service?.durationMin ?? '—'} min · Price: {service ? formatINR(service.price) : '—'}
              </p>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={() => go(1)}>
                  Back
                </Button>
                <Button disabled={!draft.slotId} onClick={() => go(3)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Review your booking</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Interviewer</dt>
                  <dd className="font-medium text-navy-950">{interviewer.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Service</dt>
                  <dd className="font-medium text-navy-950">{service?.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="font-medium text-navy-950">{service?.durationMin} min</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Date</dt>
                  <dd className="font-medium text-navy-950">{slot ? formatDateLong(slot.start) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Time</dt>
                  <dd className="font-medium text-navy-950">{slot ? formatTime(slot.start) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Timezone</dt>
                  <dd className="font-medium text-navy-950">{draft.timezone}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mode</dt>
                  <dd className="font-medium text-navy-950">Video</dd>
                </div>
              </dl>

              <h3 className="mt-6 text-sm font-semibold text-navy-950">Payment method</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(
                  [
                    ['upi', 'UPI'],
                    ['card', 'Card'],
                    ['netbanking', 'Net Banking'],
                    ['wallet', 'Wallet'],
                  ] as Array<[PaymentMethod, string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateDraft({ paymentMethod: id })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      draft.paymentMethod === id ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span>Session fee</span>
                  <span>{formatINR(sessionFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee</span>
                  <span>{formatINR(platformFee)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-navy-950">
                  <span>Total</span>
                  <span>{formatINR(sessionFee + platformFee)}</span>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Cancellation policy: Cancel at least 24 hours before the session for a full refund.
                Cancellations within 24 hours receive 50% credit toward a future interview. Payment is
                simulated in this prototype — no real charge is made.
              </p>
              {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={() => go(2)}>
                  Back
                </Button>
                <Button className="flex-1" disabled={!service || !slot || paying} onClick={() => void pay()}>
                  {paying ? 'Processing…' : 'Pay and Book'}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="h-fit p-5">
          <div className="flex items-center gap-3">
            <Avatar src={interviewer.photo} name={interviewer.name} />
            <div>
              <p className="font-semibold text-navy-950">{interviewer.name}</p>
              {isVerified(interviewer) ? <VerifiedBadge /> : null}
              <p className="text-sm text-slate-600">
                {interviewer.currentRole} @ {interviewer.company}
              </p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <dt>Service</dt>
              <dd className="font-medium text-navy-950">{service?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>When</dt>
              <dd className="font-medium text-navy-950">{slot ? formatTime(slot.start) : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd className="font-medium text-navy-950">
                {sessionFee ? formatINR(sessionFee + platformFee) : '—'}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
