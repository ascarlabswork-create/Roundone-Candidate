import { PhoneOff } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../availability/index.ts'
import { InterviewLobby } from '../components/interview/InterviewLobby.tsx'
import {
  endInterviewRoom,
  loadInterviewTiming,
  recordInterviewCallEvent,
  type InterviewServerTiming,
} from '../services/interviewCall.ts'
import { Logo } from '../components/layout/Logo.tsx'
import { CandidateFeedbackAction } from '../components/interviews/CandidateFeedbackAction.tsx'
import { CandidateReviewAction } from '../components/interviews/CandidateReviewAction.tsx'
import { Button } from '../components/ui/Button.tsx'
import { ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import {
  getCandidateInterviewByBooking,
  interviewJoinState,
  interviewStatusLabel,
  type CandidateInterview,
} from '../services/interviewSessions.ts'

const InterviewCall = lazy(() =>
  import('../components/interview/InterviewCall.tsx').then((mod) => ({ default: mod.InterviewCall })),
)

function remainingUntil(iso: string, now: Date) {
  const end = new Date(iso).getTime() - now.getTime()
  return Math.max(0, Math.floor(end / 1000))
}

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds)
  const hh = String(Math.floor(clamped / 3600)).padStart(2, '0')
  const mm = String(Math.floor((clamped % 3600) / 60)).padStart(2, '0')
  const ss = String(clamped % 60).padStart(2, '0')
  return hh === '00' ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`
}

export function InterviewRoomPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const wantJoin = params.get('join') === '1'
  const interviewState = useAsync(() => getCandidateInterviewByBooking(id), [id])
  const [joined, setJoined] = useState(false)
  const [timing, setTiming] = useState<InterviewServerTiming | null>(null)
  const [clockAnchor, setClockAnchor] = useState<{ serverMs: number; perf: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const joinRequest = useRef(wantJoin)
  const lobbyRecorded = useRef(false)
  const roomClosed = useRef(false)
  const [notes, setNotes] = useState('')
  const [mobileTab, setMobileTab] = useState<'video' | 'notes'>('video')

  const sessionId =
    interviewState.status === 'success' ? (interviewState.data.session?.id ?? '') : ''

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    async function pull() {
      const next = await loadInterviewTiming(sessionId)
      if (cancelled || !next) return
      setTiming(next)
      setClockAnchor({ serverMs: new Date(next.serverNow).getTime(), perf: performance.now() })
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId])

  useEffect(() => {
    if (!timing || !sessionId) return
    if (joinRequest.current) {
      joinRequest.current = false
      if (timing.canJoin) setJoined(true)
    }
    if (timing.phase === 'lobby' && !lobbyRecorded.current) {
      lobbyRecorded.current = true
      void recordInterviewCallEvent(sessionId, 'lobby_entered').catch(() => undefined)
    }
    if ((timing.phase === 'ended' || timing.phase === 'closed') && !roomClosed.current) {
      roomClosed.current = true
      void endInterviewRoom(sessionId)
    }
  }, [timing, sessionId])

  if (interviewState.status === 'loading') {
    return (
      <div className="p-8">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (interviewState.status === 'error' || !interviewState.data) {
    const denied =
      interviewState.status === 'error' &&
      (interviewState.error.toLowerCase().includes('access') || interviewState.error.toLowerCase().includes('not found'))
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorState
          title={denied ? 'Access denied' : 'Unable to load interview'}
          body={
            interviewState.status === 'error'
              ? interviewState.error
              : 'You don’t have access to this interview.'
          }
        />
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => navigate('/candidate/interviews')}>
            Back to My Interviews
          </Button>
        </div>
      </div>
    )
  }

  const interview = interviewState.data
  const clockNow = clockAnchor
    ? new Date(clockAnchor.serverMs + (performance.now() - clockAnchor.perf))
    : new Date(now)
  const joinState = timing
    ? serverJoinState(interview.status, timing)
    : interviewJoinState(interview, interview.session, clockNow)
  const joinable = timing?.canJoin === true
  const showWorkspace =
    joinable && Boolean(interview.session) && (joined || interview.status === 'in_progress')
  const remaining = remainingUntil(timing?.endsAt ?? interview.endsAtUtc, clockNow)

  if (
    joinState === 'completed' ||
    joinState === 'cancelled' ||
    joinState === 'no_show' ||
    joinState === 'closed' ||
    joinState === 'no_session' ||
    joinState === 'unavailable'
  ) {
    return <InterviewStatusScreen interview={interview} joinState={joinState} />
  }

  if (joinState === 'lobby' || (joinState === 'joinable' && !showWorkspace)) {
    return (
      <InterviewLobby
        interview={interview}
        now={clockNow}
        canJoin={joinable}
        interviewerJoined={timing?.interviewerJoined === true}
        onJoin={() => setJoined(true)}
      />
    )
  }

  if (!showWorkspace) {
    return <UpcomingInterviewScreen interview={interview} onBack={() => navigate('/candidate/interviews')} />
  }

  return (
    <InterviewWorkspace
      interview={interview}
      remaining={remaining}
      accepted={params.get('accepted') === '1'}
      notes={notes}
      mobileTab={mobileTab}
      onNotes={setNotes}
      onMobileTab={setMobileTab}
      onLeave={() => navigate('/candidate/interviews')}
    />
  )
}

function serverJoinState(
  status: string,
  timing: InterviewServerTiming,
): ReturnType<typeof interviewJoinState> {
  if (status === 'cancelled' || status === 'rescheduled') return 'cancelled'
  if (status === 'no_show') return 'no_show'
  if (status === 'completed' || timing.phase === 'ended') return 'completed'
  if (timing.phase === 'closed') return 'closed'
  if (timing.phase === 'scheduled') return 'upcoming'
  if (timing.phase === 'lobby') return 'lobby'
  if (timing.canJoin && status === 'in_progress') return 'in_progress'
  if (timing.canJoin) return 'joinable'
  return 'closed'
}

function InterviewStatusScreen({
  interview,
  joinState,
}: {
  interview: CandidateInterview
  joinState: ReturnType<typeof interviewJoinState>
}) {
  const navigate = useNavigate()
  const title =
    joinState === 'completed'
      ? 'Interview Completed'
      : joinState === 'closed'
        ? 'Interview join window has closed.'
        : joinState === 'cancelled'
          ? 'Interview Cancelled'
          : joinState === 'no_show'
            ? 'Interview marked as no-show'
            : joinState === 'no_session'
              ? 'Interview session is not ready yet'
              : 'This interview cannot be joined'
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <InterviewHeader interview={interview} />
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-xl font-semibold text-navy-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {joinState === 'closed'
            ? 'A new join is no longer available. The scheduled end time did not change.'
            : 'Join is unavailable for this booking.'}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {joinState === 'completed' ? (
            <>
              <CandidateFeedbackAction
                bookingId={interview.id}
                status={interview.status}
                hasFeedback={interview.hasFeedback}
                size="md"
              />
              <CandidateReviewAction
                bookingId={interview.id}
                status={interview.status}
                hasReview={interview.hasReview}
                size="md"
              />
            </>
          ) : null}
          <Button variant="outline" onClick={() => navigate('/candidate/interviews')}>
            Back to My Interviews
          </Button>
        </div>
      </div>
    </div>
  )
}

function UpcomingInterviewScreen({
  interview,
  onBack,
}: {
  interview: CandidateInterview
  onBack: () => void
}) {
  const zone = interview.displayTimezone
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <InterviewHeader interview={interview} />
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-navy-950">
          Interview starts at {formatBookingTime(interview.startsAtUtc, zone)}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The lobby opens 30 minutes before the start. Accepting this booking does not start the call.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Date</dt>
            <dd className="font-medium text-navy-950">
              {formatCivilDateWithYear(isoDateInZone(new Date(interview.startsAtUtc), zone))}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Time</dt>
            <dd className="font-medium text-navy-950">
              {formatBookingTime(interview.startsAtUtc, zone)} – {formatBookingTime(interview.endsAtUtc, zone)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Duration</dt>
            <dd className="font-medium text-navy-950">{interview.durationMin} min</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Timezone</dt>
            <dd className="font-medium text-navy-950">{zone}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="outline" onClick={onBack}>
            Back to My Interviews
          </Button>
        </div>
      </div>
    </div>
  )
}

function InterviewHeader({ interview }: { interview: CandidateInterview }) {
  const zone = interview.displayTimezone
  return (
    <header className="text-center">
      <div className="flex justify-center">
        <Logo />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-navy-950">{interview.serviceName}</h2>
      <p className="mt-1 text-sm text-slate-600">{interview.interviewType}</p>
      <dl className="mt-4 space-y-1 text-sm text-slate-700">
        <div>
          <span className="text-slate-500">Interviewer: </span>
          {interview.interviewerName}
        </div>
        <div>
          <span className="text-slate-500">Time: </span>
          {formatBookingTime(interview.startsAtUtc, zone)} – {formatBookingTime(interview.endsAtUtc, zone)}
        </div>
        <div>
          <span className="text-slate-500">Status: </span>
          {interviewStatusLabel(interview.status)}
        </div>
      </dl>
    </header>
  )
}

function InterviewWorkspace({
  interview,
  remaining,
  accepted,
  notes,
  mobileTab,
  onNotes,
  onMobileTab,
  onLeave,
}: {
  interview: CandidateInterview
  remaining: number
  accepted: boolean
  notes: string
  mobileTab: 'video' | 'notes'
  onNotes: (value: string) => void
  onMobileTab: (value: 'video' | 'notes') => void
  onLeave: () => void
}) {
  const clock = useMemo(() => formatClock(remaining), [remaining])
  const zone = interview.displayTimezone

  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo inverted />
          <div className="hidden text-sm sm:block">
            <p className="font-medium">{interview.serviceName}</p>
            <p className="text-white/70">
              Interviewer: {interview.interviewerName} · {formatBookingTime(interview.startsAtUtc, zone)} –{' '}
              {formatBookingTime(interview.endsAtUtc, zone)} · {interviewStatusLabel(interview.status)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-white/10 px-3 py-1 font-mono text-sm">{clock}</span>
          <Button variant="danger" size="sm" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </header>

      <div className="flex gap-2 border-b border-white/10 px-4 py-2 md:hidden">
        {(['video', 'notes'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onMobileTab(item)}
            className={`rounded-md px-3 py-1 text-sm capitalize ${mobileTab === item ? 'bg-white text-navy-950' : 'bg-white/10'}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={mobileTab === 'notes' ? 'hidden md:block' : ''}>
          {interview.session ? (
            <Suspense fallback={<Skeleton className="h-64" />}>
              <InterviewCall
                bookingId={interview.id}
                sessionId={interview.session.id}
                role="candidate"
                remoteName={interview.interviewerName}
                accepted={accepted}
                onLeave={onLeave}
              />
            </Suspense>
          ) : null}
        </div>

        <aside
          className={`rounded-xl bg-white p-4 text-slate-800 ${mobileTab === 'notes' ? 'block' : 'hidden'} lg:block`}
        >
          <h2 className="font-semibold text-navy-950">Notes</h2>
          <textarea
            value={notes}
            onChange={(event) => onNotes(event.target.value)}
            className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 p-3 text-sm"
            placeholder="Private notes. Only you can see these."
          />
          <h3 className="mt-4 text-sm font-semibold text-navy-950">Interview checklist</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {['Clarify constraints', 'Talk through approach', 'Handle follow-ups', 'Summarize trade-offs'].map((item) => (
              <li key={item}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="flex justify-center border-t border-white/10 px-4 py-3">
        <Button variant="danger" onClick={onLeave}>
          <PhoneOff className="h-4 w-4" />
          Leave Interview
        </Button>
      </div>
    </div>
  )
}
