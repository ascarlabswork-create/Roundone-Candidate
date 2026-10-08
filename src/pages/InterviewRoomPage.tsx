import { Circle, Maximize2, MessageSquare, Minimize2, PhoneOff, StickyNote } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../availability/index.ts'
import { InterviewAppFeedback } from '../components/interview/InterviewAppFeedback.tsx'
import { InterviewChatPanel } from '../components/interview/InterviewChatPanel.tsx'
import { InterviewLobby } from '../components/interview/InterviewLobby.tsx'
import { InterviewNotesCard, InterviewNotesPanel } from '../components/interview/InterviewNotesPanel.tsx'
import { InterviewRecordingSave } from '../components/interview/InterviewRecordingSave.tsx'
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
  interviewRoomOpensAtUtc,
  interviewStatusLabel,
  canJoinInterview,
  type CandidateInterview,
} from '../services/interviewSessions.ts'
import { shouldMountInterviewCall, shouldStayInPreCallLobby } from '../interview/callModel.ts'
import { chooseRecordingFile, writeRecordingFile } from '../interview/saveRecordingFile.ts'
import {
  canSaveInterviewRecording,
  mergeInterviewMessages,
  unreadChatCount,
  type InterviewChatMessage,
  type InterviewRecordingState,
} from '../interview/roomExperience.ts'
import { supabase } from '../lib/supabase.ts'
import {
  loadInterviewMessages,
  loadInterviewNotes,
  loadInterviewRecording,
  requestInterviewRecording,
  saveInterviewNotes,
  sendInterviewMessage,
  subscribeInterviewMessages,
  subscribeInterviewRecording,
} from '../services/interviewRoomExperience.ts'

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
  const joinable = timing ? timing.canJoin : canJoinInterview(interview, interview.session, clockNow)
  const showWorkspace = shouldMountInterviewCall({
    canJoin: joinable,
    hasSession: Boolean(interview.session),
    joined,
    status: interview.status,
  })
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

  if (shouldStayInPreCallLobby(joinState, showWorkspace)) {
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
        ? 'No new participants can join.'
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
            ? 'No new participants can join.'
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
              {interview.session ? <InterviewRecordingSave sessionId={interview.session.id} /> : null}
              {interview.session ? <InterviewNotesCard sessionId={interview.session.id} /> : null}
              {interview.session ? <InterviewAppFeedback sessionId={interview.session.id} /> : null}
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
  const roomOpenLabel = formatBookingTime(interviewRoomOpensAtUtc(interview.startsAtUtc), zone)
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <InterviewHeader interview={interview} />
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-navy-950">
          Interview room opens at {roomOpenLabel}.
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Interview starts at {formatBookingTime(interview.startsAtUtc, zone)}. You can join 15 minutes
          early and wait for the other participant.
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
  onLeave,
}: {
  interview: CandidateInterview
  remaining: number
  accepted: boolean
  onLeave: () => void
}) {
  const clock = useMemo(() => formatClock(remaining), [remaining])
  const zone = interview.displayTimezone
  const sessionId = interview.session?.id ?? ''
  const rootRef = useRef<HTMLDivElement>(null)
  const [userId, setUserId] = useState('')
  const userIdRef = useRef('')
  userIdRef.current = userId
  const [panel, setPanel] = useState<'chat' | 'notes' | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [messages, setMessages] = useState<InterviewChatMessage[]>([])
  const [seenIds, setSeenIds] = useState<ReadonlySet<string>>(() => new Set())
  const [chatError, setChatError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [recording, setRecording] = useState<InterviewRecordingState>('idle')
  const [recordingPath, setRecordingPath] = useState<string | null>(null)
  const [recordingBusy, setRecordingBusy] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const notesTimer = useRef<number | null>(null)
  const notesReady = useRef(false)
  const notesDirty = useRef(false)
  const notesValue = useRef('')
  const expanded = fullscreen || maximized
  const unread = userId ? unreadChatCount(messages, userId, seenIds) : 0

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) setUserId(data.user.id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === rootRef.current)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMaximized(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    notesReady.current = false
    notesDirty.current = false
    void loadInterviewNotes(sessionId)
      .then((value) => {
        if (cancelled) return
        if (!notesDirty.current) {
          setNotes(value)
          notesValue.current = value
        }
        notesReady.current = true
        if (notesDirty.current && userIdRef.current) {
          void saveInterviewNotes(sessionId, userIdRef.current, notesValue.current)
            .then(() => {
              if (!cancelled) setNotesStatus('saved')
            })
            .catch(() => {
              if (!cancelled) setNotesStatus('error')
            })
        }
      })
      .catch(() => {
        if (!cancelled) setNotesStatus('error')
      })
    void loadInterviewRecording(sessionId).then((snapshot) => {
      if (!cancelled) {
        setRecording(snapshot.status)
        setRecordingPath(snapshot.storagePath)
      }
    })
    return () => {
      cancelled = true
      if (notesTimer.current != null) window.clearTimeout(notesTimer.current)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    let active = true
    const stopMessages = subscribeInterviewMessages(
      sessionId,
      (message) => {
        if (active) setMessages((current) => mergeInterviewMessages(current, message))
      },
      () => {
        void loadInterviewMessages(sessionId).then((rows) => {
          if (!active) return
          setMessages((current) => rows.reduce(mergeInterviewMessages, current))
        }).catch(() => {
          if (active) setChatError('Unable to load chat.')
        })
      },
    )
    const stopRecording = subscribeInterviewRecording(sessionId, (snapshot) => {
      if (!active) return
      setRecording(snapshot.status)
      setRecordingPath(snapshot.storagePath)
    })
    return () => {
      active = false
      stopMessages()
      stopRecording()
    }
  }, [sessionId])

  function markChatSeen() {
    if (!userId) return
    setSeenIds(new Set(messages.filter((item) => item.senderUserId !== userId).map((item) => item.id)))
  }

  function choosePanel(next: 'chat' | 'notes') {
    if (panel === 'chat') markChatSeen()
    setPanel((current) => (current === next ? null : next))
  }

  function queueNotes(value: string) {
    notesDirty.current = true
    notesValue.current = value
    setNotes(value)
    if (!notesReady.current || !userIdRef.current || !sessionId) return
    if (notesTimer.current != null) window.clearTimeout(notesTimer.current)
    notesTimer.current = window.setTimeout(() => {
      void persistNotes(value)
    }, 800)
  }

  async function persistNotes(value: string) {
    const owner = userIdRef.current
    if (!owner || !sessionId) return
    setNotesStatus('saving')
    try {
      await saveInterviewNotes(sessionId, owner, value)
      setNotesStatus('saved')
    } catch {
      setNotesStatus('error')
    }
  }

  async function toggleFullscreen() {
    const node = rootRef.current
    if (!node) return
    if (document.fullscreenElement === node) {
      await document.exitFullscreen()
      setMaximized(false)
      return
    }
    try {
      await node.requestFullscreen()
      setMaximized(false)
    } catch {
      setMaximized((current) => !current)
    }
  }

  async function changeRecording(action: 'start' | 'stop' | 'save') {
    if (!sessionId || recordingBusy) return
    setRecordingBusy(true)
    setRecordingError(null)
    try {
      const chosen = action === 'save' ? await chooseRecordingFile() : null
      if (chosen === 'cancelled') return
      const snapshot = await requestInterviewRecording(sessionId, action)
      setRecording(snapshot.status)
      if (snapshot.storagePath) setRecordingPath(snapshot.storagePath)
      if (action === 'save' && snapshot.downloadUrl) {
        await writeRecordingFile(snapshot.downloadUrl, chosen)
      }
    } catch (caught) {
      setRecordingError(caught instanceof Error ? caught.message : 'Recording could not be updated. Please try again.')
    } finally {
      setRecordingBusy(false)
    }
  }

  const toolbar = (
    <>
      <Button type="button" variant={panel === 'chat' ? 'secondary' : 'outline'} onClick={() => choosePanel('chat')}>
        <span className="relative inline-flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Chat
          {unread > 0 && panel !== 'chat' ? (
            <span className="absolute -right-3 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] text-white">
              {unread}
            </span>
          ) : null}
        </span>
      </Button>
      <Button type="button" variant={panel === 'notes' ? 'secondary' : 'outline'} onClick={() => choosePanel('notes')}>
        <StickyNote className="h-4 w-4" />
        Notes
      </Button>
      <Button type="button" variant="outline" onClick={() => void toggleFullscreen()}>
        {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        {expanded ? 'Exit full screen' : 'Full screen'}
      </Button>
      <Button type="button" variant="outline" disabled={recordingBusy || recording === 'recording'} onClick={() => void changeRecording('start')}>
        <Circle className="h-4 w-4" />
        Start recording
      </Button>
      <Button type="button" variant="danger" disabled={recordingBusy || recording !== 'recording'} onClick={() => void changeRecording('stop')}>
        <Circle className="h-4 w-4 fill-current" />
        Stop recording
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={recordingBusy || !canSaveInterviewRecording(recording, recordingPath)}
        onClick={() => void changeRecording('save')}
      >
        Save recording
      </Button>
    </>
  )

  const sidePanel =
    panel === 'chat' ? (
      <InterviewChatPanel
        messages={messages}
        userId={userId}
        remoteName={interview.interviewerName}
        sending={sending}
        error={chatError}
        onClose={() => choosePanel('chat')}
        onSend={async (message) => {
          if (!userId) return
          setSending(true)
          setChatError(null)
          try {
            const saved = await sendInterviewMessage(sessionId, userId, message)
            if (saved) setMessages((current) => mergeInterviewMessages(current, saved))
          } catch (caught) {
            setChatError(caught instanceof Error ? caught.message : 'Unable to send message.')
            throw caught
          } finally {
            setSending(false)
          }
        }}
      />
    ) : panel === 'notes' ? (
      <InterviewNotesPanel
        notes={notes}
        status={notesStatus}
        onChange={queueNotes}
        onSave={() => void persistNotes(notes)}
        onClose={() => choosePanel('notes')}
      />
    ) : null

  return (
    <div
      ref={rootRef}
      className={`flex min-h-svh flex-col bg-navy-950 text-white [&:fullscreen]:h-screen [&:fullscreen]:w-screen ${
        maximized ? 'fixed inset-0 z-50 h-screen w-screen' : ''
      }`}
    >
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
          {recording === 'recording' ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1 text-sm font-medium">
              <Circle className="h-3 w-3 fill-current" />
              Recording
            </span>
          ) : null}
          <span className="rounded-md bg-white/10 px-3 py-1 font-mono text-sm">{clock}</span>
          <Button variant="danger" size="sm" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4">
          {recording === 'recording' ? (
            <p className="mb-3 text-center text-sm text-red-200">This interview is being recorded.</p>
          ) : (
            <p className="mb-3 text-center text-sm text-white/60">
              Recordings are stored privately with this interview. Stop, then Save recording to choose a folder on your computer.
            </p>
          )}
          {recordingError ? <p className="mb-3 text-center text-sm text-amber-200">{recordingError}</p> : null}
          {interview.session ? (
            <Suspense fallback={<Skeleton className="h-64" />}>
              <InterviewCall
                bookingId={interview.id}
                sessionId={interview.session.id}
                role="candidate"
                remoteName={interview.interviewerName}
                accepted={accepted}
                fill={expanded}
                toolbar={toolbar}
                onLeave={onLeave}
              />
            </Suspense>
          ) : null}
        </div>
        {sidePanel ? (
          <aside className="absolute inset-0 z-20 flex justify-end bg-black/40 md:static md:z-auto md:w-80 md:shrink-0 md:bg-transparent">
            <div className="h-full w-full max-w-sm border-l border-white/10 shadow-xl md:max-w-none md:w-80 md:shadow-none">
              {sidePanel}
            </div>
          </aside>
        ) : null}
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
