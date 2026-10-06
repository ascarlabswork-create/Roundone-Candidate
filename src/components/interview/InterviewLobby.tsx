import { useEffect, useRef, useState } from 'react'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../../availability/index.ts'
import { interviewLobbyStatusCopy } from '../../interview/callModel.ts'
import { Button } from '../ui/Button.tsx'
import { interviewRoomOpensAtUtc, type CandidateInterview } from '../../services/interviewSessions.ts'

type CheckState = 'idle' | 'ready' | 'blocked'

function remainingUntil(iso: string, now: Date) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now.getTime()) / 1000))
}

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds)
  const hh = String(Math.floor(clamped / 3600)).padStart(2, '0')
  const mm = String(Math.floor((clamped % 3600) / 60)).padStart(2, '0')
  const ss = String(clamped % 60).padStart(2, '0')
  return hh === '00' ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`
}

export function InterviewLobby({
  interview,
  now,
  canJoin,
  interviewerJoined,
  onJoin,
}: {
  interview: CandidateInterview
  now: Date
  canJoin: boolean
  interviewerJoined: boolean
  onJoin: () => void
}) {
  const zone = interview.displayTimezone
  const startLabel = formatBookingTime(interview.startsAtUtc, zone)
  const roomOpensAt = interviewRoomOpensAtUtc(interview.startsAtUtc)
  const roomOpenLabel = formatBookingTime(roomOpensAt, zone)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camera, setCamera] = useState<CheckState>('idle')
  const [microphone, setMicrophone] = useState<CheckState>('idle')
  const [speaker, setSpeaker] = useState<CheckState>('idle')
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [joining, setJoining] = useState(false)
  const countdown = formatClock(remainingUntil(interview.startsAtUtc, now))
  const started = now.getTime() >= new Date(interview.startsAtUtc).getTime()
  const statusCopy = interviewLobbyStatusCopy({
    startsAtMs: new Date(interview.startsAtUtc).getTime(),
    nowMs: now.getTime(),
    roomOpensAtLabel: roomOpenLabel,
    canJoin,
  })

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  async function checkDevices() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCamera(stream.getVideoTracks().some((track) => track.readyState === 'live') ? 'ready' : 'blocked')
      setMicrophone(stream.getAudioTracks().some((track) => track.readyState === 'live') ? 'ready' : 'blocked')
    } catch {
      setCamera('blocked')
      setMicrophone('blocked')
    }
  }

  async function checkSpeaker() {
    try {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      gain.gain.value = 0.04
      oscillator.frequency.value = 440
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      window.setTimeout(() => {
        oscillator.stop()
        void context.close()
      }, 250)
      setSpeaker('ready')
    } catch {
      setSpeaker('blocked')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-500">Pre-interview lobby</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy-950">
          {interview.interviewType || 'Interview'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">Interview starts at {startLabel}</p>
        <p className="mt-1 text-sm text-slate-600">{statusCopy}</p>
        <p className="mt-4 font-mono text-3xl font-semibold text-navy-950">{started ? '00:00' : countdown}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Date</dt>
            <dd className="font-medium text-navy-950">
              {formatCivilDateWithYear(isoDateInZone(new Date(interview.startsAtUtc), zone))}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Start time</dt>
            <dd className="font-medium text-navy-950">{startLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Duration</dt>
            <dd className="font-medium text-navy-950">{interview.durationMin} min</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Interviewer status</dt>
            <dd className="font-medium text-navy-950">
              {interviewerJoined ? 'Interviewer is connected.' : 'Waiting for interviewer...'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 overflow-hidden rounded-lg bg-navy-950">
          <video ref={videoRef} autoPlay playsInline muted className="h-48 w-full object-cover" />
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>Camera check: {labelFor(camera)}</li>
          <li>Microphone check: {labelFor(microphone)}</li>
          <li>Speaker check: {labelFor(speaker)}</li>
          <li>Network check: {online ? 'Online' : 'Offline'}</li>
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => void checkDevices()}>
            Test camera and microphone
          </Button>
          <Button variant="outline" onClick={() => void checkSpeaker()}>
            Test speaker
          </Button>
        </div>
        <Button
          className="mt-4"
          fullWidth
          disabled={!canJoin || joining}
          onClick={() => {
            setJoining(true)
            onJoin()
          }}
        >
          {joining ? 'Connecting...' : 'Join Interview'}
        </Button>
        {!canJoin ? (
          <p className="mt-2 text-center text-xs text-slate-500">{statusCopy}</p>
        ) : null}
      </div>
    </div>
  )
}

function labelFor(state: CheckState) {
  if (state === 'ready') return 'Ready'
  if (state === 'blocked') return 'Needs permission'
  return 'Not tested'
}
