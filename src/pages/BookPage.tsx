import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  formatBookingTime,
  formatCivilDateCard,
  formatCivilDateWithYear,
  isoDateInZone,
} from '../availability/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, EmptyState, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { Avatar, VerifiedBadge } from '../components/ui/identity.tsx'
import { candidateDisplayTimezone, formatTimezoneLabel } from '../lib/candidateTimezone.ts'
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
import { getCandidatePreferencesIfPresent } from '../services/candidateProfile.ts'
import { filterSlotsByPreferredRange } from '../services/bookableSlots.ts'
import { useBookingDraft } from '../state/booking.tsx'
import { useSession } from '../state/session.tsx'

const steps = ['Choose Date & Time', 'Review & Confirm'] as const
const STALE_SLOT_MESSAGE = 'This slot was just taken'

type BookingHeader = {
  id: string
  name: string
  photo: string
  currentRole: string
  company: string
  timezone: string | null
  verified: boolean
  listPricePaise: number | null
  currency: string
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
    listPricePaise: interviewer.listPricePaise,
    currency: interviewer.currency || 'INR',
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
  const creatingRef = useRef(false)

  const requestedStep = Number(params.get('step') ?? '1')
  const step: 1 | 2 = requestedStep >= 2 && draft.startsAtUtc ? 2 : 1
  const preselectedService = params.get('service')

  const publicState = useAsync(() => {
    if (!isUuid(id)) return Promise.reject(new Error('Interviewer not found'))
    return getPublicBookingContext(id)
  }, [id, pageNonce])

  useEffect(() => {
    if (draft.interviewerId === id) return
    setWindowIndex(0)
    setStaleMessage('')
    resetDraft(id, candidateDisplayTimezone(account?.profile.timezone))
  }, [account?.profile.timezone, draft.interviewerId, id, resetDraft])

  useEffect(() => {
    if (draft.interviewerId !== id) return
    if (draft.startsAtUtc) return
    const candidateTz = candidateDisplayTimezone(account?.profile.timezone)
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
  const header: BookingHeader | null = liveInterviewer ? headerFromLive(liveInterviewer) : null

  const service = services.find((item) => item.id === draft.serviceId) ?? null
  const interviewerId = liveInterviewer?.id || draft.interviewerProfileId || draft.interviewerId || id
  const canLoadSlots = Boolean(header) && isUuid(interviewerId)
  const availabilityKey = service?.id ?? `availability:${interviewerId}`
  const durationMin = service?.durationMin ?? 45
  const pricePaise = service?.pricePaise ?? header?.listPricePaise ?? 0
  const currency = service?.currency ?? header?.currency ?? 'INR'

  useEffect(() => {
    if (publicState.status !== 'success') return
    const available = publicState.data?.services ?? EMPTY_SERVICES
    if (available.length === 0) {
      if (!liveInterviewer) return
      if (draft.interviewerProfileId === liveInterviewer.id && !draft.serviceId) return
      setWindowIndex(0)
      setSelectedDay('')
      updateDraft({
        serviceId: '',
        interviewerId: liveInterviewer.id,
        interviewerProfileId: liveInterviewer.id,
        ...emptySlotPatch(),
      })
      return
    }
    const preferred = preselectedService
      ? available.find((item) => item.id === preselectedService)
      : null
    const picked =
      preferred ??
      available.reduce((shortest, item) => (item.durationMin < shortest.durationMin ? item : shortest))
    if (draft.serviceId === picked.id) return
    setWindowIndex(0)
    setSelectedDay('')
    updateDraft({
      serviceId: picked.id,
      interviewerId: picked.interviewerProfileId,
      interviewerProfileId: picked.interviewerProfileId,
      ...emptySlotPatch(),
    })
  }, [
    draft.interviewerProfileId,
    draft.serviceId,
    liveInterviewer,
    preselectedService,
    publicState.data?.services,
    publicState.status,
    updateDraft,
  ])

  const displayTimeZone = candidateDisplayTimezone(
    draft.displayTimezone || draft.timezone || account?.profile.timezone,
  )

  const availabilityState = useAsync(async (): Promise<AvailabilityQueryResult> => {
    if (step !== 1 || !canLoadSlots) {
      return { serviceId: '', windowIndex, slots: EMPTY_SLOTS }
    }
    const { from, to } = getBookableWindow(windowIndex)
    const nextSlots = await getBookableSlots({
      interviewerProfileId: interviewerId,
      serviceId: service?.id ?? null,
      from,
      to,
    })
    return { serviceId: availabilityKey, windowIndex, slots: nextSlots }
  }, [availabilityKey, canLoadSlots, interviewerId, service?.id, step, windowIndex, retryNonce])

  const preferenceState = useAsync(() => getCandidatePreferencesIfPresent(), [])
  const availabilityReady =
    availabilityState.status === 'success' &&
    canLoadSlots &&
    availabilityState.data.serviceId === availabilityKey &&
    availabilityState.data.windowIndex === windowIndex
  const availabilityLoading =
    step === 1 &&
    canLoadSlots &&
    (availabilityState.status === 'loading' ||
      preferenceState.status === 'loading' ||
      (!availabilityReady && availabilityState.status !== 'error'))
  const preferredStart =
    preferenceState.status === 'success' ? (preferenceState.data?.preferred_date ?? '') : ''
  const preferredEnd =
    preferenceState.status === 'success' ? (preferenceState.data?.preferred_end_date ?? '') : ''
  const slots =
    availabilityReady && availabilityState.data ? availabilityState.data.slots : EMPTY_SLOTS
  const rangedSlots = useMemo(
    () =>
      preferenceState.status === 'loading'
        ? EMPTY_SLOTS
        : filterSlotsByPreferredRange(slots, displayTimeZone, preferredStart, preferredEnd),
    [displayTimeZone, preferenceState.status, preferredEnd, preferredStart, slots],
  )
  const days = useMemo(
    () => groupSlotsByDisplayDate(rangedSlots, displayTimeZone),
    [rangedSlots, displayTimeZone],
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

  const priceLabel = formatMoneyFromPaise(pricePaise, currency)

  function go(next: number) {
    const copy = new URLSearchParams(params)
    copy.set('step', String(next))
    setParams(copy)
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

  async function continueToReview() {
    if (!canLoadSlots || !selectedSlot) return
    setRechecking(true)
    setError('')
    setStaleMessage('')
    try {
      const stillOpen = await isSlotStillBookable({
        interviewerProfileId: interviewerId,
        serviceId: service?.id ?? null,
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
      go(2)
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

    const interviewerProfileId =
      draft.interviewerProfileId || service?.interviewerProfileId || draft.interviewerId || interviewerId
    const displayZone = draft.displayTimezone || displayTimeZone
    const validation = validateCreateBookingInput({
      serviceId: draft.serviceId || null,
      startsAtUtc: draft.startsAtUtc,
      endsAtUtc: draft.endsAtUtc,
      displayTimezone: displayZone,
      interviewerProfileId,
      durationMin,
    })
    if (validation) {
      setError(validation)
      return
    }

    const input = {
      serviceId: draft.serviceId || null,
      startsAtUtc: draft.startsAtUtc,
      displayTimezone: displayZone,
      endsAtUtc: draft.endsAtUtc,
      interviewerProfileId,
      durationMin,
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
        go(1)
        return
      }
      setError(err instanceof BookingError ? err.message : 'Unable to create your booking. Please try again.')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  const pageLoading =
    publicState.status === 'loading'
  const pageError =
    publicState.status === 'error'
      ? publicState.error
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
      <Link to={`/candidate/interviewers/${header.id}`} className="text-sm font-medium text-coral-700">
        ← Back to profile
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-navy-950">Book your interview</h1>

      <ol className="mt-6 grid grid-cols-2 gap-2 text-sm">
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
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Choose date & time</h2>
              <p className="mt-1 text-sm text-slate-600">
                Only dates and times returned by this interviewer&apos;s live availability are shown. You
                cannot enter a custom time.
              </p>
              <div className="mt-4">
                <p className="text-sm font-medium text-navy-950">Your timezone</p>
                <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-navy-950">
                  {formatTimezoneLabel(displayTimeZone)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Detected automatically. Open times are shown in this timezone
                  {header.timezone ? `, converted from the interviewer's ${formatTimezoneLabel(header.timezone)}` : ''}.
                </p>
              </div>
              <p className="mt-4 text-sm text-slate-600">Duration: {durationMin} min</p>
              <p className="text-sm text-slate-600">Price: {priceLabel}</p>
              {!service ? (
                <p className="mt-2 text-xs text-slate-500">
                  Showing open times from this interviewer&apos;s calendar (no session package published yet).
                </p>
              ) : null}

              {canLoadSlots && availabilityLoading ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                  <p className="text-sm font-medium text-navy-950">Checking available times...</p>
                </div>
              ) : null}

              {canLoadSlots && availabilityState.status === 'error' ? (
                <div className="mt-6">
                  <ErrorState
                    title="Unable to load availability."
                    body="Please try again."
                    retryLabel="Retry"
                    onRetry={() => setRetryNonce((value) => value + 1)}
                  />
                </div>
              ) : null}

              {canLoadSlots && availabilityReady ? (
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
                      body={
                        preferredStart && slots.length > 0
                          ? 'None of the open times fall in your preferred dates. Update those dates on your profile, or try another period.'
                          : 'Try a later period, or view another interviewer.'
                      }
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

          {step === 2 ? (
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Review your booking</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Interviewer</dt>
                  <dd className="font-medium text-navy-950">{header.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="font-medium text-navy-950">{durationMin} min</dd>
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
                  <span>{priceLabel}</span>
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
                <Button variant="outline" onClick={() => go(1)} disabled={creating}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canLoadSlots || !selectedSlot || creating || status === 'loading'}
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
