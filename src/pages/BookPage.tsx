import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getInterviewer } from '../api/index.ts'
import {
  formatBookingTime,
  formatCivilDateCard,
  formatCivilDateWithYear,
  isoDateInZone,
} from '../availability/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, EmptyState, ErrorState, FieldLabel, SelectInput, Skeleton } from '../components/ui/primitives.tsx'
import { Avatar, VerifiedBadge } from '../components/ui/identity.tsx'
import { TIMEZONES } from '../data/catalogs.ts'
import { isVerified } from '../data/interviewers.ts'
import { formatMoneyFromPaise } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  civilDateForSlot,
  getBookableWindow,
  getBookableSlots,
  groupSlotsByDisplayDate,
  isSlotStillBookable,
  type UtcBookableSlot,
} from '../services/availability.ts'
import {
  BookingError,
  createBooking,
  getCandidateBooking,
  sameHeldSlot,
  validateCreateBookingInput,
} from '../services/bookings.ts'
import {
  getPublicBookingContext,
  type PublicInterviewer,
  type PublicInterviewerService,
} from '../services/interviewerPublic.ts'
import { useBookingDraft } from '../state/booking.tsx'
import { useSession } from '../state/session.tsx'
import type { Interviewer } from '../types.ts'

const steps = ['Select Service', 'Choose Date & Time', 'Review & Confirm'] as const
const STALE_SLOT_MESSAGE = 'This slot was just taken'

type BookingHeader = {
  id: string
  name: string
  photo: string
  currentRole: string
  company: string
  timezone: string | null
  verified: boolean
}

function headerFromLive(interviewer: PublicInterviewer): BookingHeader {
  return {
    id: interviewer.id,
    name: interviewer.name,
    photo: interviewer.photo ?? '',
    currentRole: interviewer.currentRole ?? '',
    company: interviewer.company ?? '',
    timezone: interviewer.timezone,
    verified: interviewer.identityVerified && interviewer.employmentVerified,
  }
}

function headerFromMock(interviewer: Interviewer): BookingHeader {
  return {
    id: interviewer.id,
    name: interviewer.name,
    photo: interviewer.photo,
    currentRole: interviewer.currentRole,
    company: interviewer.company,
    timezone: interviewer.timezone,
    verified: isVerified(interviewer),
  }
}

function emptySlotPatch() {
  return {
    slotId: '',
    selectedDate: '',
    selectedSlot: '',
    startsAtUtc: '',
    endsAtUtc: '',
    createdBookingId: '',
  }
}

function timezoneOptions(current: string) {
  if ((TIMEZONES as readonly string[]).includes(current)) return TIMEZONES
  return [current, ...TIMEZONES]
}

const EMPTY_SERVICES: PublicInterviewerService[] = []
const EMPTY_SLOTS: UtcBookableSlot[] = []

type AvailabilityQueryResult = {
  serviceId: string
  windowIndex: number
  slots: UtcBookableSlot[]
}

export function BookPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { account, status, user } = useSession()
  const location = useLocation()
  const { draft, updateDraft, resetDraft } = useBookingDraft()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [staleMessage, setStaleMessage] = useState('')
  const [selectedDay, setSelectedDay] = useState('')
  const [windowIndex, setWindowIndex] = useState(0)
  const [retryNonce, setRetryNonce] = useState(0)
  const [pageNonce, setPageNonce] = useState(0)
  const [rechecking, setRechecking] = useState(false)
  const timezoneTouched = useRef(false)
  const creatingRef = useRef(false)

  const step = Number(params.get('step') ?? '1') as 1 | 2 | 3
  const preselectedService = params.get('service')

  const publicState = useAsync(() => getPublicBookingContext(id), [id, pageNonce])
  const mockState = useAsync(
    () => (isUuid(id) ? Promise.resolve(null) : getInterviewer(id)),
    [id, pageNonce],
  )

  useEffect(() => {
    if (draft.interviewerId === id) return
    timezoneTouched.current = false
    setWindowIndex(0)
    setStaleMessage('')
    resetDraft(id, account?.profile.timezone)
  }, [account?.profile.timezone, draft.interviewerId, id, resetDraft])

  useEffect(() => {
    if (timezoneTouched.current) return
    if (draft.interviewerId !== id) return
    if (draft.startsAtUtc) return
    const candidateTz = account?.profile.timezone
    if (!candidateTz) return
    if (draft.timezone === candidateTz && draft.displayTimezone === candidateTz) return
    updateDraft({ timezone: candidateTz, displayTimezone: candidateTz })
  }, [
    account?.profile.timezone,
    draft.displayTimezone,
    draft.interviewerId,
    draft.startsAtUtc,
    draft.timezone,
    id,
    updateDraft,
  ])

  const services = publicState.data?.services ?? EMPTY_SERVICES
  const liveInterviewer = publicState.data?.interviewer ?? null
  const header: BookingHeader | null = liveInterviewer
    ? headerFromLive(liveInterviewer)
    : mockState.status === 'success' && mockState.data
      ? headerFromMock(mockState.data)
      : isUuid(id) && publicState.status === 'success'
        ? {
            id,
            name: 'Interviewer',
            photo: '',
            currentRole: '',
            company: '',
            timezone: null,
            verified: false,
          }
        : null

  const service = services.find((item) => item.id === draft.serviceId) ?? null

  useEffect(() => {
    if (!preselectedService || publicState.status !== 'success') return
    const exists = (publicState.data?.services ?? EMPTY_SERVICES).some((item) => item.id === preselectedService)
    if (exists && draft.serviceId !== preselectedService) {
      updateDraft({ serviceId: preselectedService, ...emptySlotPatch() })
    }
  }, [draft.serviceId, preselectedService, publicState.data?.services, publicState.status, updateDraft])

  const displayTimeZone =
    draft.displayTimezone || draft.timezone || account?.profile.timezone || 'Asia/Kolkata'

  const availabilityState = useAsync(async (): Promise<AvailabilityQueryResult> => {
    if (step !== 2 || !service) {
      return { serviceId: '', windowIndex, slots: EMPTY_SLOTS }
    }
    const { from, to } = getBookableWindow(windowIndex)
    const nextSlots = await getBookableSlots({
      interviewerProfileId: service.interviewerProfileId,
      serviceId: service.id,
      from,
      to,
    })
    return { serviceId: service.id, windowIndex, slots: nextSlots }
  }, [service?.id, service?.interviewerProfileId, step, windowIndex, retryNonce])

  const availabilityReady =
    availabilityState.status === 'success' &&
    Boolean(service) &&
    availabilityState.data.serviceId === service?.id &&
    availabilityState.data.windowIndex === windowIndex
  const availabilityLoading =
    step === 2 && Boolean(service) && (availabilityState.status === 'loading' || (!availabilityReady && availabilityState.status !== 'error'))

  const slots =
    availabilityReady && availabilityState.data ? availabilityState.data.slots : EMPTY_SLOTS
  const days = useMemo(
    () => groupSlotsByDisplayDate(slots, displayTimeZone),
    [slots, displayTimeZone],
  )

  const selectedSlot: UtcBookableSlot | null =
    draft.startsAtUtc && draft.endsAtUtc
      ? { startsAtUtc: draft.startsAtUtc, endsAtUtc: draft.endsAtUtc }
      : null

  const dateFromSlot = selectedSlot ? civilDateForSlot(selectedSlot, displayTimeZone) : ''
  const activeDay = days.some((day) => day.date === selectedDay)
    ? selectedDay
    : days.some((day) => day.date === dateFromSlot)
      ? dateFromSlot
      : days.some((day) => day.date === draft.selectedDate)
        ? draft.selectedDate
        : (days[0]?.date ?? '')
  const visibleSlots = days.find((day) => day.date === activeDay)?.slots ?? EMPTY_SLOTS

  const priceLabel = service ? formatMoneyFromPaise(service.pricePaise, service.currency) : '—'

  function go(next: number) {
    const copy = new URLSearchParams(params)
    copy.set('step', String(next))
    setParams(copy)
  }

  function chooseService(item: PublicInterviewerService) {
    setStaleMessage('')
    setWindowIndex(0)
    setSelectedDay('')
    updateDraft({
      serviceId: item.id,
      interviewerId: item.interviewerProfileId,
      interviewerProfileId: item.interviewerProfileId,
      ...emptySlotPatch(),
    })
  }

  function chooseSlot(slot: UtcBookableSlot, date: string) {
    setStaleMessage('')
    updateDraft({
      slotId: slot.startsAtUtc,
      selectedDate: date,
      selectedSlot: formatBookingTime(slot.startsAtUtc, displayTimeZone),
      startsAtUtc: slot.startsAtUtc,
      endsAtUtc: slot.endsAtUtc,
      timezone: displayTimeZone,
      displayTimezone: displayTimeZone,
    })
  }

  function changeTimezone(nextZone: string) {
    timezoneTouched.current = true
    const nextDate = selectedSlot ? civilDateForSlot(selectedSlot, nextZone) : ''
    updateDraft({
      timezone: nextZone,
      displayTimezone: nextZone,
      selectedDate: nextDate,
      selectedSlot: selectedSlot ? formatBookingTime(selectedSlot.startsAtUtc, nextZone) : draft.selectedSlot,
    })
    if (nextDate) setSelectedDay(nextDate)
  }

  async function continueToReview() {
    if (!service || !selectedSlot) return
    setRechecking(true)
    setError('')
    setStaleMessage('')
    try {
      const stillOpen = await isSlotStillBookable({
        interviewerProfileId: service.interviewerProfileId,
        serviceId: service.id,
        slot: selectedSlot,
      })
      if (!stillOpen) {
        setStaleMessage(STALE_SLOT_MESSAGE)
        updateDraft(emptySlotPatch())
        setRetryNonce((value) => value + 1)
        return
      }
      updateDraft({
        slotId: selectedSlot.startsAtUtc,
        selectedDate: activeDay,
        selectedSlot: formatBookingTime(selectedSlot.startsAtUtc, displayTimeZone),
        startsAtUtc: selectedSlot.startsAtUtc,
        endsAtUtc: selectedSlot.endsAtUtc,
        timezone: displayTimeZone,
        displayTimezone: displayTimeZone,
      })
      go(3)
    } catch {
      setStaleMessage('')
      setRetryNonce((value) => value + 1)
      setError('Unable to load availability.')
    } finally {
      setRechecking(false)
    }
  }

  async function confirmBooking() {
    if (creatingRef.current || creating) return
    setError('')
    setStaleMessage('')

    if (status === 'loading') return
    if (status !== 'authenticated' || !user) {
      const next = `${location.pathname}${location.search}`
      navigate(`/candidate/login?next=${encodeURIComponent(next)}`)
      return
    }

    const interviewerProfileId = draft.interviewerProfileId || service?.interviewerProfileId || draft.interviewerId
    const displayZone = draft.displayTimezone || displayTimeZone
    const validation = validateCreateBookingInput({
      serviceId: draft.serviceId,
      startsAtUtc: draft.startsAtUtc,
      endsAtUtc: draft.endsAtUtc,
      displayTimezone: displayZone,
      interviewerProfileId,
    })
    if (validation) {
      setError(validation)
      return
    }

    const input = {
      serviceId: draft.serviceId,
      startsAtUtc: draft.startsAtUtc,
      displayTimezone: displayZone,
      endsAtUtc: draft.endsAtUtc,
      interviewerProfileId,
    }

    creatingRef.current = true
    setCreating(true)
    try {
      if (draft.createdBookingId) {
        try {
          const existing = await getCandidateBooking(draft.createdBookingId)
          if (sameHeldSlot(existing, input)) {
            navigate(`/candidate/booking/confirmation?bookingId=${existing.id}`)
            return
          }
        } catch {
          updateDraft({ createdBookingId: '' })
        }
      }

      const booking = await createBooking(input)
      updateDraft({
        createdBookingId: booking.id,
        interviewerProfileId: booking.interviewerProfileId,
        interviewerId: booking.interviewerProfileId,
        startsAtUtc: booking.startsAtUtc,
        endsAtUtc: booking.endsAtUtc,
        displayTimezone: booking.displayTimezone,
        timezone: booking.displayTimezone,
      })
      navigate(`/candidate/booking/confirmation?bookingId=${booking.id}`)
    } catch (err) {
      if (err instanceof BookingError && err.code === 'unauthenticated') {
        const next = `${location.pathname}${location.search}`
        navigate(`/candidate/login?next=${encodeURIComponent(next)}`)
        return
      }
      if (err instanceof BookingError && err.code === 'slot_unavailable') {
        setStaleMessage('This slot was just taken.')
        updateDraft(emptySlotPatch())
        setRetryNonce((value) => value + 1)
        go(2)
        return
      }
      setError(err instanceof BookingError ? err.message : 'Unable to create your booking. Please try again.')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  const pageLoading =
    publicState.status === 'loading' || (!isUuid(id) && mockState.status === 'loading')
  const pageError =
    publicState.status === 'error'
      ? publicState.error
      : !isUuid(id) && mockState.status === 'error'
        ? mockState.error
        : null

  if (pageLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (pageError || !header) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <ErrorState
          title={pageError ? 'Unable to load availability.' : 'Interviewer not found'}
          body={pageError ?? 'This interviewer is not available to book.'}
          retryLabel="Retry"
          onRetry={() => setPageNonce((value) => value + 1)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to={`/candidate/interviewers/${header.id}`} className="text-sm font-medium text-blue-700">
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
              {services.length ? (
                services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseService(item)}
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
                        {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                      </div>
                      <p className="font-semibold text-navy-950">
                        {formatMoneyFromPaise(item.pricePaise, item.currency)}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState
                  title="This interviewer has no bookable services."
                  body="Live services come from the interviewer directory. Choose another interviewer to continue."
                  action={
                    <Link to="/candidate/interviewers">
                      <Button variant="outline">View another interviewer</Button>
                    </Link>
                  }
                />
              )}
              <Button className="mt-4" disabled={!service} onClick={() => go(2)} fullWidth>
                Continue
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Choose date & time</h2>
              <p className="mt-1 text-sm text-slate-600">
                Only dates and times returned by this interviewer&apos;s live availability are shown. You
                cannot enter a custom time.
              </p>
              <div className="mt-4">
                <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                <SelectInput
                  id="timezone"
                  value={displayTimeZone}
                  onChange={(event) => changeTimezone(event.target.value)}
                >
                  {timezoneOptions(displayTimeZone).map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </SelectInput>
                {header.timezone ? (
                  <p className="mt-2 text-xs text-slate-500">Interviewer timezone: {header.timezone}</p>
                ) : null}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Duration: {service?.durationMin ?? '—'} min
              </p>
              <p className="text-sm text-slate-600">Price: {priceLabel}</p>

              {!service ? (
                <div className="mt-6">
                  <EmptyState
                    title="Select a service first."
                    body="Availability depends on the selected service duration."
                    action={
                      <Button variant="outline" onClick={() => go(1)}>
                        Select service
                      </Button>
                    }
                  />
                </div>
              ) : null}

              {service && availabilityLoading ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                  <p className="text-sm font-medium text-navy-950">Checking available times...</p>
                </div>
              ) : null}

              {service && availabilityState.status === 'error' ? (
                <div className="mt-6">
                  <ErrorState
                    title="Unable to load availability."
                    body="Please try again."
                    retryLabel="Retry"
                    onRetry={() => setRetryNonce((value) => value + 1)}
                  />
                </div>
              ) : null}

              {service && availabilityReady ? (
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
                            if (day.date === activeDay) return
                            updateDraft({
                              selectedDate: day.date,
                              slotId: '',
                              selectedSlot: '',
                              startsAtUtc: '',
                              endsAtUtc: '',
                            })
                          }}
                          className={`min-w-36 shrink-0 rounded-lg border px-3 py-2 text-left text-sm ${
                            activeDay === day.date
                              ? 'border-navy-950 bg-navy-950 text-white'
                              : 'border-slate-200'
                          }`}
                        >
                          {formatCivilDateCard(day.date)}
                        </button>
                      ))}
                    </div>
                    <h3 className="mt-6 text-sm font-semibold text-navy-950">Available times</h3>
                    {visibleSlots.length ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {visibleSlots.map((item) => (
                          <button
                            key={item.startsAtUtc}
                            type="button"
                            onClick={() => chooseSlot(item, activeDay)}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              draft.startsAtUtc === item.startsAtUtc
                                ? 'border-navy-950 bg-navy-950 text-white'
                                : 'border-slate-200'
                            }`}
                          >
                            {formatBookingTime(item.startsAtUtc, displayTimeZone)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No available slots on this date."
                        body="Pick another date from this interviewer’s open availability."
                      />
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      {windowIndex > 0 ? (
                        <Button variant="outline" size="sm" onClick={() => setWindowIndex((value) => Math.max(0, value - 1))}>
                          Earlier dates
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setWindowIndex((value) => value + 1)}>
                        Later dates
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-6">
                    <EmptyState
                      title="No available interview slots in the selected period."
                      body="Try a later period, or view another interviewer."
                      action={
                        <div className="flex flex-wrap justify-center gap-3">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setWindowIndex((value) => value + 1)
                              setRetryNonce((value) => value + 1)
                            }}
                          >
                            Try another date
                          </Button>
                          <Link to="/candidate/interviewers">
                            <Button variant="outline">View another interviewer</Button>
                          </Link>
                        </div>
                      }
                    />
                    {windowIndex > 0 ? (
                      <div className="mt-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => setWindowIndex((value) => Math.max(0, value - 1))}>
                          Earlier dates
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )
              ) : null}

              {staleMessage ? <p className="mt-4 text-sm font-medium text-red-700">{staleMessage}</p> : null}
              {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={() => go(1)}>
                  Back
                </Button>
                <Button
                  disabled={!draft.startsAtUtc || rechecking}
                  onClick={() => void continueToReview()}
                  className="flex-1"
                >
                  {rechecking ? 'Checking available times...' : 'Continue'}
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
                  <dd className="font-medium text-navy-950">{header.name}</dd>
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
                      ? formatCivilDateWithYear(isoDateInZone(new Date(selectedSlot.startsAtUtc), displayTimeZone))
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Time</dt>
                  <dd className="font-medium text-navy-950">
                    {selectedSlot ? formatBookingTime(selectedSlot.startsAtUtc, displayTimeZone) : '—'}
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

              <div className="mt-6 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span>Listed session fee</span>
                  <span>{service ? formatMoneyFromPaise(service.pricePaise, service.currency) : '—'}</span>
                </div>
                <p className="text-xs text-slate-500">
                  The amount due is confirmed by the server after your slot is held.
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Confirming holds this slot for 10 minutes. Payment is not charged in this step. If someone
                else books first, you will be asked to pick another time.
              </p>
              {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={() => go(2)} disabled={creating}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!service || !selectedSlot || creating || status === 'loading'}
                  onClick={() => void confirmBooking()}
                >
                  {creating ? 'Holding slot…' : status === 'authenticated' ? 'Confirm booking' : 'Sign in to confirm'}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="h-fit p-5">
          <div className="flex items-center gap-3">
            <Avatar src={header.photo} name={header.name} />
            <div>
              <p className="font-semibold text-navy-950">{header.name}</p>
              {header.verified ? <VerifiedBadge /> : null}
              {header.currentRole || header.company ? (
                <p className="text-sm text-slate-600">
                  {header.currentRole}
                  {header.currentRole && header.company ? ' @ ' : ''}
                  {header.company}
                </p>
              ) : null}
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
                {selectedSlot ? formatBookingTime(selectedSlot.startsAtUtc, displayTimeZone) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd className="font-medium text-navy-950">{service ? priceLabel : '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
