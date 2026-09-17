import {
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../availability/index.ts'
import { Logo } from '../components/layout/Logo.tsx'
import { CandidateFeedbackAction } from '../components/interviews/CandidateFeedbackAction.tsx'
import { Button } from '../components/ui/Button.tsx'
import { ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import {
  canJoinInterview,
  getCandidateInterviewByBooking,
  interviewJoinState,
  interviewStatusLabel,
  type CandidateInterview,
} from '../services/interviewSessions.ts'

const codingProblem = {
  title: 'Design an LRU Cache',
  prompt:
    'Implement an LRU (Least Recently Used) cache with get and put in O(1). Follow-up: how would you shard this across machines?',
  starter: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity
    // TODO: hashmap + doubly linked list
  }

  get(key) {
    return -1
  }

  put(key, value) {
    
  }
}`,
  tests: [
    { name: 'get missing key', result: 'pass' },
    { name: 'evicts least recently used', result: 'fail' },
    { name: 'updates existing key', result: 'idle' },
  ],
}

const designPrompt = {
  title: 'Design a URL shortener',
  question:
    'Design a URL shortening service like bit.ly. Cover API, storage, unique ID generation, redirects, and scale to 100M new URLs per day.',
}

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
  const [joined, setJoined] = useState(wantJoin)
  const [now, setNow] = useState(() => Date.now())
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [notes, setNotes] = useState('')
  const [code, setCode] = useState(codingProblem.starter)
  const [ran, setRan] = useState(false)
  const [mobileTab, setMobileTab] = useState<'video' | 'work' | 'notes'>('video')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

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
  const clockNow = new Date(now)
  const joinable = canJoinInterview(interview, interview.session, clockNow)
  const joinState = interviewJoinState(interview, interview.session, clockNow)
  const showWorkspace = joinable && (joined || wantJoin || interview.status === 'in_progress')
  const remaining = remainingUntil(interview.endsAtUtc, clockNow)

  if (joinState === 'completed' || joinState === 'cancelled' || joinState === 'no_show' || joinState === 'no_session' || joinState === 'unavailable') {
    return <InterviewStatusScreen interview={interview} joinState={joinState} />
  }

  if (!showWorkspace) {
    return <UpcomingInterviewScreen interview={interview} joinable={joinable} onJoin={() => setJoined(true)} />
  }

  return (
    <StubWorkspace
      interview={interview}
      remaining={remaining}
      muted={muted}
      cameraOff={cameraOff}
      notes={notes}
      code={code}
      ran={ran}
      mobileTab={mobileTab}
      onMute={() => setMuted((value) => !value)}
      onCamera={() => setCameraOff((value) => !value)}
      onNotes={setNotes}
      onCode={setCode}
      onRun={() => setRan(true)}
      onMobileTab={setMobileTab}
      onLeave={() => navigate('/candidate/interviews')}
    />
  )
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
        <p className="mt-2 text-sm text-slate-600">Join is unavailable for this booking.</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {joinState === 'completed' ? (
            <CandidateFeedbackAction
              bookingId={interview.id}
              status={interview.status}
              hasFeedback={interview.hasFeedback}
              size="md"
            />
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
  joinable,
  onJoin,
}: {
  interview: CandidateInterview
  joinable: boolean
  onJoin: () => void
}) {
  const navigate = useNavigate()
  const zone = interview.displayTimezone
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <InterviewHeader interview={interview} />
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-navy-950">Upcoming session</h1>
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
          <Button disabled={!joinable} onClick={onJoin}>
            Join Interview
          </Button>
          {!joinable ? (
            <p className="text-center text-xs text-slate-500">
              Join opens 15 minutes before the scheduled start. This is a stub workspace — no live video yet.
            </p>
          ) : null}
          <Button variant="outline" onClick={() => navigate('/candidate/interviews')}>
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

function StubWorkspace({
  interview,
  remaining,
  muted,
  cameraOff,
  notes,
  code,
  ran,
  mobileTab,
  onMute,
  onCamera,
  onNotes,
  onCode,
  onRun,
  onMobileTab,
  onLeave,
}: {
  interview: CandidateInterview
  remaining: number
  muted: boolean
  cameraOff: boolean
  notes: string
  code: string
  ran: boolean
  mobileTab: 'video' | 'work' | 'notes'
  onMute: () => void
  onCamera: () => void
  onNotes: (value: string) => void
  onCode: (value: string) => void
  onRun: () => void
  onMobileTab: (value: 'video' | 'work' | 'notes') => void
  onLeave: () => void
}) {
  const clock = useMemo(() => formatClock(remaining), [remaining])
  const isCoding = interview.interviewType === 'Coding'
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
        {(['video', 'work', 'notes'] as const).map((item) => (
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
        <div className={`space-y-4 ${mobileTab !== 'video' && mobileTab !== 'work' ? 'hidden md:block' : ''}`}>
          <div className={`grid gap-3 ${mobileTab === 'work' ? 'hidden md:grid' : 'grid'} md:grid-cols-3`}>
            <div className="relative min-h-48 rounded-xl bg-navy-800 md:col-span-2">
              <div className="flex h-full items-center justify-center text-sm text-white/80">
                {interview.interviewerName} · interviewer video (stub)
              </div>
            </div>
            <div className="relative min-h-32 rounded-xl bg-navy-800">
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                {cameraOff ? 'Camera off' : 'You · candidate video (stub)'}
              </div>
            </div>
          </div>

          <div className={`${mobileTab === 'video' ? 'hidden md:block' : ''}`}>
            {isCoding ? (
              <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="rounded-xl bg-white p-4 text-slate-800">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {interview.interviewType} · {interview.durationMin} min
                  </p>
                  <h2 className="mt-2 font-semibold text-navy-950">{codingProblem.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{codingProblem.prompt}</p>
                  <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Test cases</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {codingProblem.tests.map((test) => (
                      <li key={test.name}>
                        {ran && test.result === 'pass' ? '✓' : ran && test.result === 'fail' ? '✕' : '○'} {test.name}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-4" size="sm" onClick={onRun}>
                    Run Code
                  </Button>
                </div>
                <textarea
                  value={code}
                  onChange={(event) => onCode(event.target.value)}
                  className="min-h-72 rounded-xl bg-[#0f172a] p-4 font-mono text-sm text-slate-100 outline-none"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4 text-slate-800">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {interview.interviewType} · {interview.serviceName}
                  </p>
                  <h2 className="mt-2 font-semibold text-navy-950">{designPrompt.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{designPrompt.question}</p>
                  <label className="mt-4 block text-sm font-medium text-navy-950" htmlFor="arch-notes">
                    Architecture notes
                  </label>
                  <textarea
                    id="arch-notes"
                    className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm"
                    placeholder="Clients → API → cache → DB..."
                  />
                </div>
                <div className="min-h-72 rounded-xl border border-dashed border-white/20 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:24px_24px] p-4">
                  <p className="text-sm text-white/70">Whiteboard (stub)</p>
                  <div className="mt-8 flex justify-center gap-6 text-xs text-white/80">
                    <span className="rounded-md border border-white/30 px-4 py-3">Client</span>
                    <span className="self-center">→</span>
                    <span className="rounded-md border border-white/30 px-4 py-3">API</span>
                    <span className="self-center">→</span>
                    <span className="rounded-md border border-white/30 px-4 py-3">Store</span>
                  </div>
                </div>
              </div>
            )}
          </div>
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

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <Control label={muted ? 'Unmute' : 'Mute'} onClick={onMute}>
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Control>
        <Control label={cameraOff ? 'Start video' : 'Video'} onClick={onCamera}>
          {cameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Control>
        <Control label="Screen Share">
          <MonitorUp className="h-4 w-4" />
        </Control>
        <Control label="Chat">
          <MessageSquare className="h-4 w-4" />
        </Control>
        <Control label="More">
          <MoreHorizontal className="h-4 w-4" />
        </Control>
        <Button variant="danger" onClick={onLeave}>
          <PhoneOff className="h-4 w-4" />
          Leave Interview
        </Button>
      </div>
    </div>
  )
}

function Control({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
