import { ConnectionState, Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication } from 'livekit-client'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CallRole } from '../../interview/callModel.ts'
import { reduceCallPresence, remoteLeftLabel, waitingLabel, type CallPresence } from '../../interview/callModel.ts'
import { Button } from '../ui/Button.tsx'
import {
  beginInterviewCall,
  interviewCallErrorMessage,
  recordInterviewCallEvent,
  requestInterviewToken,
  InterviewCallError,
} from '../../services/interviewCall.ts'

type InterviewCallProps = {
  bookingId: string
  sessionId: string
  role: CallRole
  remoteName: string
  accepted?: boolean
  onLeave: () => void
}

export function InterviewCall({ bookingId, sessionId, role, remoteName, accepted = false, onLeave }: InterviewCallProps) {
  const roomRef = useRef<Room | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const leftRef = useRef(false)
  const [presence, setPresence] = useState<CallPresence>('connecting')
  const [connection, setConnection] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room
    leftRef.current = false
    let cancelled = false
    let started = false

    const attachRemote = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) track.attach(remoteVideoRef.current)
      if (track.kind === Track.Kind.Audio && remoteAudioRef.current) track.attach(remoteAudioRef.current)
    }

    const attachLocal = () => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (publication?.track && localVideoRef.current) publication.track.attach(localVideoRef.current)
    }

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (!cancelled) setConnection(state)
    })
    room.on(RoomEvent.TrackSubscribed, (track) => {
      attachRemote(track)
      if (!cancelled) setPresence((current) => reduceCallPresence(current, 'remote_joined'))
    })
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach()
    })
    room.on(RoomEvent.LocalTrackPublished, () => attachLocal())
    room.on(RoomEvent.ParticipantConnected, () => {
      if (!cancelled) setPresence((current) => reduceCallPresence(current, 'remote_joined'))
    })
    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (!cancelled && room.remoteParticipants.size === 0) {
        setPresence((current) => reduceCallPresence(current, 'remote_left'))
      }
    })
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled && !leftRef.current) {
        setError('The call disconnected. You can try to reconnect.')
        setPresence((current) => reduceCallPresence(current, 'failed'))
      }
    })

    async function connect() {
      try {
        const access = await requestInterviewToken({ bookingId, sessionId })
        if (cancelled) return
        await room.connect(access.livekitUrl, access.token)
        started = true
        if (cancelled) {
          room.disconnect()
          return
        }
        try {
          await room.localParticipant.setMicrophoneEnabled(true)
        } catch {
          if (!cancelled) {
            setMicOn(false)
            setError(interviewCallErrorMessage('permission'))
          }
        }
        try {
          await room.localParticipant.setCameraEnabled(true)
        } catch {
          if (!cancelled) {
            setCameraOn(false)
            setError(interviewCallErrorMessage('permission'))
          }
        }
        attachLocal()
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication: RemoteTrackPublication) => {
            if (publication.track) attachRemote(publication.track)
          })
        })
        if (room.remoteParticipants.size > 0) {
          if (!cancelled) setPresence('live')
        } else if (!cancelled) {
          setPresence((current) => reduceCallPresence(current, 'connected'))
        }
        await beginInterviewCall(sessionId)
      } catch (caught) {
        if (cancelled) return
        const code = caught instanceof InterviewCallError ? caught.code : 'connection'
        setError(caught instanceof InterviewCallError ? caught.message : interviewCallErrorMessage(code))
        setPresence((current) => reduceCallPresence(current, 'failed'))
      }
    }

    void connect()

    return () => {
      cancelled = true
      const alreadyLeft = leftRef.current
      leftRef.current = true
      if (!alreadyLeft && started) {
        void recordInterviewCallEvent(sessionId, 'participant_left').catch(() => undefined)
      }
      room.removeAllListeners()
      room.disconnect()
      roomRef.current = null
    }
  }, [attempt, bookingId, sessionId])

  async function toggleMic() {
    const room = roomRef.current
    if (!room) return
    const next = !micOn
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
    } catch {
      setMicOn(false)
      setError(interviewCallErrorMessage('permission'))
    }
  }

  async function toggleCamera() {
    const room = roomRef.current
    if (!room) return
    const next = !cameraOn
    try {
      await room.localParticipant.setCameraEnabled(next)
      setCameraOn(next)
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (publication?.track && localVideoRef.current) publication.track.attach(localVideoRef.current)
    } catch {
      setCameraOn(false)
      setError(interviewCallErrorMessage('permission'))
    }
  }

  async function endCall() {
    if (leftRef.current) return
    leftRef.current = true
    setPresence((current) => reduceCallPresence(current, 'local_end'))
    try {
      await recordInterviewCallEvent(sessionId, 'participant_left')
      await recordInterviewCallEvent(sessionId, 'call_ended')
    } catch {
      // Leaving still disconnects if the event write fails.
    }
    roomRef.current?.disconnect()
    onLeave()
  }

  const statusLine =
    presence === 'connecting'
      ? accepted
        ? 'Interview accepted. Connecting...'
        : 'Connecting...'
      : presence === 'waiting'
        ? waitingLabel(role)
        : presence === 'remote_left'
          ? remoteLeftLabel(role)
          : presence === 'failed'
            ? error
            : connection === ConnectionState.Reconnecting
              ? 'Reconnecting...'
              : connection === ConnectionState.Connected
                ? 'Connected'
                : 'Connecting...'

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative min-h-48 overflow-hidden rounded-xl bg-navy-800 md:col-span-2">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full min-h-48 w-full object-cover" />
          <audio ref={remoteAudioRef} autoPlay />
          {presence !== 'live' ? (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white/80">
              {statusLine}
            </div>
          ) : (
            <p className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-xs text-white">{remoteName}</p>
          )}
        </div>
        <div className="relative min-h-32 overflow-hidden rounded-xl bg-navy-800">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full min-h-32 w-full object-cover" />
          {!cameraOn ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Camera off</div>
          ) : null}
          <p className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-xs text-white">You</p>
        </div>
      </div>
      {error && presence !== 'failed' ? <p className="text-sm text-amber-200">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" onClick={() => void toggleMic()}>
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {micOn ? 'Mute' : 'Unmute'}
        </Button>
        <Button type="button" variant="outline" onClick={() => void toggleCamera()}>
          {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          {cameraOn ? 'Camera off' : 'Camera on'}
        </Button>
        {presence === 'failed' ? (
          <Button type="button" variant="outline" onClick={() => { setError(null); setPresence('connecting'); setAttempt((value) => value + 1) }}>
            Reconnect
          </Button>
        ) : null}
        <Button type="button" variant="danger" onClick={() => void endCall()}>
          <PhoneOff className="h-4 w-4" />
          End call
        </Button>
      </div>
    </div>
  )
}
