import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createBooking, getAvailability, getInterviewer, platformFeeFor } from '../api/index.ts'
import { formatCivilDateLong, formatTimeInZone, isoDateInZone } from '../availability/index.ts'
import type { BookableSlot } from '../availability/types.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, EmptyState, ErrorState, FieldLabel, SelectInput, Skeleton } from '../components/ui/primitives.tsx'
import { Avatar, VerifiedBadge } from '../components/ui/identity.tsx'
import { TIMEZONES } from '../data/catalogs.ts'
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
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null)

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
  const displayTimeZone = draft.timezone || interviewer?.availability.timezone || 'Asia/Kolkata'

  const availabilityState = useAsync(
    () =>
      interviewer && draft.serviceId
        ? getAvailability(interviewer.id, draft.serviceId, displayTimeZone)
        : Promise.resolve(null),
    [interviewer?.id, draft.serviceId, displayTimeZone],
  )

  const days = availabilityState.status === 'success' ? availabilityState.data?.days ?? [] : []
  const activeDay = days.some((day) => day.date === selectedDay) ? selectedDay : days[0]?.date ?? ''
  const visibleSlots = days.find((day) => day.date === activeDay)?.slots ?? []

  useEffect(() => {
    if (!activeDay) return
    if (selectedDay !== activeDay) setSelectedDay(activeDay)
  }, [activeDay, selectedDay])

  useEffect(() => {
    if (!draft.slotId || selectedSlot) return
    const found = days.flatMap((day) => day.slots).find((item) => item.id === draft.slotId)
    if (found) setSelectedSlot(found)
  }, [days, draft.slotId, selectedSlot])

  const sessionFee = service?.price ?? 0
  const platformFee = sessionFee ? platformFeeFor(sessionFee) : 0

  function go(next: number) {
    const copy = new URLSearchParams(params)
    copy.set('step', String(next))
    setParams(copy)
  }

  function chooseSlot(slot: BookableSlot) {
    setSelectedSlot(slot)
    updateDraft({ slotId: slot.id, timezone: displayTimeZone })
  }

  async function pay() {
    if (!service || !selectedSlot) return
    setPaying(true)
    setError('')
    try {
      const booking = await createBooking(draft, draft.paymentMethod)
      navigate(`/candidate/booking/confirmation?bookingId=${booking.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setSelectedSlot(null)
      updateDraft({ slotId: '' })
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
                  onClick={() => {
                    updateDraft({ serviceId: item.id, slotId: '' })
                    setSelectedSlot(null)
                  }}
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
              <p className="mt-1 text-sm text-slate-600">
                Only dates and times from this interviewer&apos;s availability are shown. You cannot enter a
                custom time.
              </p>
              <div className="mt-4">
                <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                <SelectInput
                  id="timezone"
                  value={displayTimeZone}
                  onChange={(event) => {
                    updateDraft({ timezone: event.target.value, slotId: '' })
                    setSelectedSlot(null)
                  }}
                >
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </SelectInput>
                <p className="mt-2 text-xs text-slate-500">
                  Interviewer timezone: {interviewer.availability.timezone}
                </p>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Duration: {service?.durationMin ?? '—'} min · Price: {service ? formatINR(service.price) : '—'}
              </p>

              {availabilityState.status === 'loading' ? <Skeleton className="mt-4 h-40" /> : null}
              {availabilityState.status === 'error' ? (
                <div className="mt-4">
                  <ErrorState body={availabilityState.error} />
                </div>
              ) : null}

              {availabilityState.status === 'success' ? (
                days.length ? (
                  <>
                    <h3 className="mt-6 text-sm font-semibold text-navy-950">Available dates</h3>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                      {days.map((day) => (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => {
                            setSelectedDay(day.date)
                            setSelectedSlot(null)
                            updateDraft({ slotId: '' })
                          }}
                          className={`min-w-36 shrink-0 rounded-lg border px-3 py-2 text-left text-sm ${
                            activeDay === day.date
                              ? 'border-navy-950 bg-navy-950 text-white'
                              : 'border-slate-200'
                          }`}
                        >
                          {formatCivilDateLong(day.date)}
                        </button>
                      ))}
                    </div>
                    <h3 className="mt-6 text-sm font-semibold text-navy-950">Available time slots</h3>
                    {visibleSlots.length ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {visibleSlots.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => chooseSlot(item)}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              draft.slotId === item.id
                                ? 'border-navy-950 bg-navy-950 text-white'
                                : 'border-slate-200'
                            }`}
                          >
                            {formatTimeInZone(item.start, displayTimeZone)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No available slots on this date."
                        body="Pick another date from this interviewer’s open availability."
                      />
                    )}
                  </>
                ) : (
                  <div className="mt-6">
                    <EmptyState
                      title="No available slots"
                      body="This interviewer has no valid bookable times for the selected service in the next four weeks."
                    />
                  </div>
                )
              ) : null}

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
                  <dd className="font-medium text-navy-950">
                    {selectedSlot
                      ? formatCivilDateLong(isoDateInZone(new Date(selectedSlot.start), displayTimeZone))
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Time</dt>
                  <dd className="font-medium text-navy-950">
                    {selectedSlot ? formatTimeInZone(selectedSlot.start, displayTimeZone) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Timezone</dt>
                  <dd className="font-medium text-navy-950">{displayTimeZone}</dd>
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
                ).map(([methodId, label]) => (
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
                simulated in this prototype — no real charge is made. The selected slot is rechecked before
                the booking is created.
              </p>
              {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={() => go(2)}>
                  Back
                </Button>
                <Button className="flex-1" disabled={!service || !selectedSlot || paying} onClick={() => void pay()}>
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
              <dd className="font-medium text-navy-950">
                {selectedSlot ? formatTimeInZone(selectedSlot.start, displayTimeZone) : '—'}
              </dd>
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
