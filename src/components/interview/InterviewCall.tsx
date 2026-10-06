import { ConnectionState, Room, RoomEvent, Track, TrackEvent, type RemoteAudioTrack, type RemoteTrack, type RemoteTrackPublication } from 'livekit-client'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CallRole } from '../../interview/callModel.ts'
import { reduceCallPresence, remoteLeftLabel, waitingLabel, connectedRemoteLabel, type CallPresence } from '../../interview/callModel.ts'
import {
  applyRemoteAudioElement,
  logCallAudio,
  needsAudioSubscription,
  playbackNeedsUserGesture,
} from '../../interview/remoteAudioPlayback.ts'
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
  fill?: boolean
  toolbar?: ReactNode
  onLeave: () => void
}

export function InterviewCall({
  bookingId,
  sessionId,
  role,
  remoteName,
  accepted: _accepted = false,
  fill = false,
  toolbar,
  onLeave,
}: InterviewCallProps) {
  const roomRef = useRef<Room | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const leftRef = useRef(false)
  const [presence, setPresence] = useState<CallPresence>('connecting')
  const [connection, setConnection] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [playbackBlocked, setPlaybackBlocked] = useState(false)

  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room
    leftRef.current = false
    let cancelled = false
    let started = false
    const audioElements = new Map<string, HTMLAudioElement>()
    setPlaybackBlocked(false)

    const onPlaybackStarted = () => {
      logCallAudio('playback started')
      if (!cancelled) setPlaybackBlocked(false)
    }
    const onPlaybackFailed = () => {
      logCallAudio('playback blocked')
      if (!cancelled) setPlaybackBlocked(true)
    }

    const attachAudio = (track: RemoteTrack) => {
      const id = track.sid ?? track.mediaStreamID
      const host = document.body
      let element = audioElements.get(id)
      if (!element) {
        element = document.createElement('audio')
        element.autoplay = true
        host.appendChild(element)
        audioElements.set(id, element)
      }
      applyRemoteAudioElement(element)
      track.attach(element)
      applyRemoteAudioElement(element)
      if (isRemoteAudioTrack(track)) track.setVolume(1)
      element.muted = false
      element.volume = 1
      logCallAudio('remote audio attached', {
        id,
        muted: element.muted,
        volume: element.volume,
        trackMuted: track.isMuted,
      })
      track.off(TrackEvent.AudioPlaybackStarted, onPlaybackStarted)
      track.off(TrackEvent.AudioPlaybackFailed, onPlaybackFailed)
      track.on(TrackEvent.AudioPlaybackStarted, onPlaybackStarted)
      track.on(TrackEvent.AudioPlaybackFailed, onPlaybackFailed)
      void element.play().then(onPlaybackStarted, onPlaybackFailed)
    }

    const detachAudio = (track: RemoteTrack) => {
      const id = track.sid ?? track.mediaStreamID
      const element = id ? audioElements.get(id) : undefined
      track.off(TrackEvent.AudioPlaybackStarted, onPlaybackStarted)
      track.off(TrackEvent.AudioPlaybackFailed, onPlaybackFailed)
      if (element) track.detach(element)
      else track.detach()
      element?.remove()
      if (id) audioElements.delete(id)
      logCallAudio('remote audio removed', { id })
    }

    const attachRemote = (track: RemoteTrack) => {
      if (cancelled) return
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) track.attach(remoteVideoRef.current)
      if (track.kind === Track.Kind.Audio) attachAudio(track)
    }

    const subscribeRemoteAudio = (publication: RemoteTrackPublication) => {
      if (needsAudioSubscription(publication.kind, publication.isSubscribed)) {
        void publication.setSubscribed(true)
      }
    }

    const attachLocal = () => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (publication?.track && localVideoRef.current) publication.track.attach(localVideoRef.current)
    }

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (!cancelled) setConnection(state)
    })
    room.on(RoomEvent.TrackSubscribed, (track, publication) => {
      if (track.kind === Track.Kind.Audio) {
        logCallAudio('remote audio subscribed', {
          source: publication.source,
          muted: publication.isMuted,
          sid: publication.trackSid,
        })
      }
      attachRemote(track)
      if (!cancelled) setPresence((current) => reduceCallPresence(current, 'remote_joined'))
    })
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      logCallAudio('remote track published', {
        identity: participant.identity,
        kind: publication.kind,
        source: publication.source,
        muted: publication.isMuted,
      })
      subscribeRemoteAudio(publication)
    })
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) detachAudio(track)
      else track.detach()
    })
    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (publication.kind === Track.Kind.Audio) {
        logCallAudio('remote audio muted', { identity: participant.identity })
      }
    })
    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (publication.kind === Track.Kind.Audio) {
        logCallAudio('remote audio unmuted', { identity: participant.identity })
      }
    })
    room.on(RoomEvent.AudioPlaybackStatusChanged, (allowed) => {
      logCallAudio(allowed ? 'playback started' : 'playback blocked', { room: true })
      if (!cancelled && !allowed) setPlaybackBlocked(true)
    })
    room.on(RoomEvent.LocalTrackPublished, () => attachLocal())
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      logCallAudio('participant joined', { identity: participant.identity })
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
            subscribeRemoteAudio(publication)
            if (publication.track) attachRemote(publication.track)
          })
        })
        if (audioElements.size > 0) {
          void room.startAudio().then(onPlaybackStarted, onPlaybackFailed)
        }
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
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track?.kind === Track.Kind.Audio) detachAudio(publication.track)
          else publication.track?.detach()
        })
      })
      audioElements.forEach((element) => element.remove())
      audioElements.clear()
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

  async function enableAudio() {
    const room = roomRef.current
    if (!room) return
    try {
      await room.startAudio()
      setPlaybackBlocked(false)
    } catch {
      setPlaybackBlocked(true)
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
      ? 'Connecting...'
      : presence === 'waiting'
        ? waitingLabel(role)
        : presence === 'live'
          ? connectedRemoteLabel(role)
          : presence === 'remote_left'
          ? remoteLeftLabel(role)
          : presence === 'failed'
            ? error ?? 'Unable to join interview. Please try again.'
            : connection === ConnectionState.Reconnecting
              ? 'Reconnecting...'
              : connection === ConnectionState.Connected
                ? 'Connected'
                : 'Connecting...'

  return (
    <div className={fill ? 'flex h-full min-h-0 flex-1 flex-col gap-3' : 'space-y-3'}>
      <div className={fill ? 'relative min-h-0 flex-1' : 'grid gap-3 md:grid-cols-3'}>
        <div className={fill ? 'absolute inset-0 overflow-hidden rounded-xl bg-navy-800' : 'relative min-h-48 overflow-hidden rounded-xl bg-navy-800 md:col-span-2'}>
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full min-h-48 w-full object-cover" />
          {presence !== 'live' ? (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white/80">
              {statusLine}
            </div>
          ) : (
            <p className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-xs text-white">{remoteName}</p>
          )}
        </div>
        <div
          className={
            fill
              ? 'absolute bottom-3 right-3 z-10 h-28 w-36 overflow-hidden rounded-xl bg-navy-800 shadow-lg sm:h-36 sm:w-48'
              : 'relative min-h-32 overflow-hidden rounded-xl bg-navy-800'
          }
        >
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full min-h-32 w-full object-cover" />
          {!cameraOn ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Camera off</div>
          ) : null}
          <p className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-xs text-white">You</p>
        </div>
      </div>
      {playbackNeedsUserGesture(!playbackBlocked) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p>Enable audio to hear the other person.</p>
          <Button type="button" size="sm" onClick={() => void enableAudio()}>
            Enable audio
          </Button>
        </div>
      ) : null}
      {error && presence !== 'failed' ? <p className="text-sm text-amber-200">{error}</p> : null}
      {presence !== 'failed' ? <p className="text-center text-sm text-white/80">{statusLine}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" onClick={() => void toggleMic()}>
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {micOn ? 'Mute' : 'Unmute'}
        </Button>
        <Button type="button" variant="outline" onClick={() => void toggleCamera()}>
          {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          {cameraOn ? 'Camera off' : 'Camera on'}
        </Button>
        {toolbar}
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

function isRemoteAudioTrack(track: RemoteTrack): track is RemoteAudioTrack {
  return track.kind === Track.Kind.Audio
}
