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
import { useNavigate, useParams } from 'react-router-dom'
import { getBooking, getInterviewer } from '../api/index.ts'
import { Logo } from '../components/layout/Logo.tsx'
import { Button } from '../components/ui/Button.tsx'
import { ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'

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

export function InterviewRoomPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const bookingState = useAsync(() => getBooking(id), [id])
  const interviewerId = bookingState.status === 'success' ? bookingState.data.interviewerId : ''
  const interviewerState = useAsync(
    () => (interviewerId ? getInterviewer(interviewerId) : Promise.reject(new Error('Missing'))),
    [interviewerId],
  )

  const [seconds, setSeconds] = useState(60 * 60)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [notes, setNotes] = useState('')
  const [code, setCode] = useState(codingProblem.starter)
  const [ran, setRan] = useState(false)
  const [mobileTab, setMobileTab] = useState<'video' | 'work' | 'notes'>('video')

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const clock = useMemo(() => {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }, [seconds])

  if (bookingState.status === 'loading') {
    return (
      <div className="p-8">
        <Skeleton className="h-96" />
      </div>
    )
  }
  if (bookingState.status === 'error') {
    return (
      <div className="p-8">
        <ErrorState body={bookingState.error} />
      </div>
    )
  }

  const booking = bookingState.data
  const interviewerName =
    interviewerState.status === 'success' ? interviewerState.data.name : 'Interviewer'
  const isCoding = booking.interviewType === 'Coding'

  function endSession() {
    navigate(`/candidate/feedback/${booking.id}`)
  }

  return (
    <div className="flex min-h-svh flex-col bg-navy-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo inverted />
          <div className="hidden text-sm sm:block">
            <p className="font-medium">{booking.interviewType}</p>
            <p className="text-white/70">{interviewerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-white/10 px-3 py-1 font-mono text-sm">{clock}</span>
          <Button variant="danger" size="sm" onClick={endSession}>
            End Session
          </Button>
        </div>
      </header>

      <div className="flex gap-2 border-b border-white/10 px-4 py-2 md:hidden">
        {(['video', 'work', 'notes'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMobileTab(item)}
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
                {interviewerName} · interviewer video
              </div>
            </div>
            <div className="relative min-h-32 rounded-xl bg-navy-800">
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                {cameraOff ? 'Camera off' : 'You · candidate video'}
              </div>
            </div>
          </div>

          <div className={`${mobileTab === 'video' ? 'hidden md:block' : ''}`}>
            {isCoding ? (
              <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="rounded-xl bg-white p-4 text-slate-800">
                  <p className="text-xs font-semibold uppercase text-slate-500">Problem</p>
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
                  <Button className="mt-4" size="sm" onClick={() => setRan(true)}>
                    Run Code
                  </Button>
                </div>
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="min-h-72 rounded-xl bg-[#0f172a] p-4 font-mono text-sm text-slate-100 outline-none"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4 text-slate-800">
                  <p className="text-xs font-semibold uppercase text-slate-500">Question</p>
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
                  <p className="text-sm text-white/70">Whiteboard</p>
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
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 p-3 text-sm"
            placeholder="Private notes. Only you can see these."
          />
          <h3 className="mt-4 text-sm font-semibold text-navy-950">Interview checklist</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {[
              'Clarify constraints',
              'Talk through approach',
              'Handle follow-ups',
              'Summarize trade-offs',
            ].map((item) => (
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
        <Control
          label={muted ? 'Unmute' : 'Mute'}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Control>
        <Control
          label={cameraOff ? 'Start video' : 'Video'}
          onClick={() => setCameraOff((value) => !value)}
        >
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
        <Button variant="danger" onClick={endSession}>
          <PhoneOff className="h-4 w-4" />
          End Interview
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
