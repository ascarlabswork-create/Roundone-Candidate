import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  type RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client'
import { Hand, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CallRole } from '../../interview/callModel.ts'
import { reduceCallPresence, remoteLeftLabel, waitingLabel, connectedRemoteLabel, type CallPresence } from '../../interview/callModel.ts'
import {
  applyRemoteAudioElement,
  logCallAudio,
  needsAudioSubscription,
  playbackNeedsUserGesture,
} from '../../interview/remoteAudioPlayback.ts'
import { encodeHandSignal, parseHandSignal, participantLabel, ROOM_SIGNAL_TOPIC } from '../../interview/roomSignaling.ts'
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
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const leftRef = useRef(false)
  const [presence, setPresence] = useState<CallPresence>('connecting')
  const [connection, setConnection] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [localSharing, setLocalSharing] = useState(false)
  const [remoteSharing, setRemoteSharing] = useState(false)
  const [remoteScreenIdentity, setRemoteScreenIdentity] = useState<string | null>(null)
  const [localHandRaised, setLocalHandRaised] = useState(false)
  const [remoteHandRaised, setRemoteHandRaised] = useState(false)
  const [stageLayout, setStageLayout] = useState<'auto' | 'camera' | 'screen'>('auto')
  const [mediaNotice, setMediaNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const [remoteHandIdentity, setRemoteHandIdentity] = useState<string | null>(null)

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

    const syncRemoteScreenState = () => {
      if (cancelled) return
      let active = false
      let identity: string | null = null
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.source === Track.Source.ScreenShare && publication.track && publication.isSubscribed) {
            active = true
            identity = participant.identity
          }
        })
      })
      setRemoteSharing(active)
      setRemoteScreenIdentity(active ? identity : null)
    }

    const attachRemoteVideo = (track: RemoteTrack, source: Track.Source, identity: string) => {
      if (cancelled || track.kind !== Track.Kind.Video) return
      if (source === Track.Source.ScreenShare) {
        if (screenVideoRef.current) track.attach(screenVideoRef.current)
        setRemoteSharing(true)
        setRemoteScreenIdentity(identity)
      } else if (source === Track.Source.Camera && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current)
      }
    }

    const attachRemote = (track: RemoteTrack, source: Track.Source = Track.Source.Camera, identity = '') => {
      if (cancelled) return
      if (track.kind === Track.Kind.Video) attachRemoteVideo(track, source, identity)
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

    const attachLocalScreen = () => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
      if (publication?.track && screenVideoRef.current) {
        publication.track.attach(screenVideoRef.current)
        if (!cancelled) setLocalSharing(true)
      }
    }

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (!cancelled) setConnection(state)
    })
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        logCallAudio('remote audio subscribed', {
          source: publication.source,
          muted: publication.isMuted,
          sid: publication.trackSid,
        })
      }
      attachRemote(track, publication.source, participant.identity)
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
    room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
      if (track.kind === Track.Kind.Audio) detachAudio(track)
      else {
        track.detach()
        if (publication.source === Track.Source.ScreenShare) syncRemoteScreenState()
      }
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
    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      attachLocal()
      if (publication.source === Track.Source.ScreenShare) attachLocalScreen()
    })
    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.ScreenShare) {
        publication.track?.detach()
        if (!cancelled) {
          setLocalSharing(false)
          setMediaNotice(null)
        }
      }
    })
    room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (participant?.isLocal) return
      if (topic && topic !== ROOM_SIGNAL_TOPIC) return
      const raised = parseHandSignal(payload)
      if (raised === null) return
      if (!cancelled) {
        setRemoteHandRaised(raised)
        setRemoteHandIdentity(participant?.identity ?? null)
      }
    })
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      logCallAudio('participant joined', { identity: participant.identity })
      if (!cancelled) setPresence((current) => reduceCallPresence(current, 'remote_joined'))
    })
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!cancelled) {
        setRemoteHandIdentity((identity) => {
          if (identity === participant.identity) {
            setRemoteHandRaised(false)
            return null
          }
          return identity
        })
        syncRemoteScreenState()
      }
      if (!cancelled && room.remoteParticipants.size === 0) {
        setPresence((current) => reduceCallPresence(current, 'remote_left'))
        setRemoteHandRaised(false)
        setRemoteHandIdentity(null)
        setRemoteSharing(false)
        setRemoteScreenIdentity(null)
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
            if (publication.track) attachRemote(publication.track, publication.source, participant.identity)
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

  async function toggleScreenShare() {
    const room = roomRef.current
    if (!room || typeof room.localParticipant.setScreenShareEnabled !== 'function') {
      setMediaNotice('Screen sharing is not supported in this browser.')
      return
    }
    const next = !localSharing
    try {
      await room.localParticipant.setScreenShareEnabled(next)
      setMediaNotice(null)
      if (next) {
        attachLocalScreenFromRoom(room)
        setStageLayout('auto')
      } else {
        setLocalSharing(false)
      }
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : caught instanceof Error ? caught.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMediaNotice('Screen sharing was blocked. Allow screen capture in your browser settings.')
      } else if (name === 'AbortError' || name === 'NotReadableError') {
        setMediaNotice(null)
      } else {
        setMediaNotice('Could not start screen sharing. Try again or use a supported browser.')
      }
      setLocalSharing(Boolean(room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track))
    }
  }

  function attachLocalScreenFromRoom(room: Room) {
    const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
    if (publication?.track && screenVideoRef.current) {
      publication.track.attach(screenVideoRef.current)
      setLocalSharing(true)
    }
  }

  async function toggleHand() {
    const room = roomRef.current
    if (!room) return
    const next = !localHandRaised
    try {
      await room.localParticipant.publishData(encodeHandSignal(next), { reliable: true, topic: ROOM_SIGNAL_TOPIC })
      setLocalHandRaised(next)
      setMediaNotice(null)
    } catch {
      setMediaNotice('Could not update raise hand. Reconnect if the problem continues.')
    }
  }

  async function endCall() {
    if (leftRef.current) return
    leftRef.current = true
    setPresence((current) => reduceCallPresence(current, 'local_end'))
    const room = roomRef.current
    if (room) {
      try {
        if (localHandRaised) {
          await room.localParticipant.publishData(encodeHandSignal(false), { reliable: true, topic: ROOM_SIGNAL_TOPIC })
        }
      } catch {
        // Best-effort hand reset before leave.
      }
      try {
        if (room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track) {
          await room.localParticipant.setScreenShareEnabled(false)
        }
      } catch {
        // Best-effort stop share before leave.
      }
    }
    try {
      await recordInterviewCallEvent(sessionId, 'participant_left')
      await recordInterviewCallEvent(sessionId, 'call_ended')
    } catch {
      // Leaving still disconnects if the event write fails.
    }
    roomRef.current?.disconnect()
    onLeave()
  }

  const hasShare = localSharing || remoteSharing
  const layoutMode = hasShare ? stageLayout : 'auto'
  const focusScreen = hasShare && layoutMode !== 'camera'
  const sharingBanner = localSharing
    ? 'You are sharing your screen'
    : remoteSharing
      ? `${participantLabel(remoteScreenIdentity ?? '', remoteName)} is sharing their screen`
      : null

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
        <div
          className={
            fill
              ? 'absolute inset-0 overflow-hidden rounded-xl bg-navy-800'
              : 'relative min-h-48 overflow-hidden rounded-xl bg-navy-800 md:col-span-2'
          }
        >
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className={
              focusScreen
                ? 'absolute inset-0 z-0 h-full w-full bg-black object-contain'
                : 'pointer-events-none absolute h-0 w-0 opacity-0'
            }
            aria-hidden={!focusScreen}
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={
              focusScreen
                ? 'absolute bottom-3 left-3 z-10 h-28 w-36 rounded-lg object-cover shadow-lg sm:h-36 sm:w-48'
                : 'h-full min-h-48 w-full object-cover'
            }
          />
          {sharingBanner ? (
            <p className="absolute left-3 right-3 top-3 z-20 rounded-md bg-black/60 px-3 py-2 text-center text-xs text-white sm:text-sm">
              {sharingBanner}
            </p>
          ) : null}
          {remoteHandRaised ? (
            <p
              className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-1 text-xs font-medium text-amber-950"
              role="status"
              aria-live="polite"
            >
              <Hand className="h-3.5 w-3.5" aria-hidden />
              {participantLabel(remoteHandIdentity ?? '', remoteName)} raised their hand
            </p>
          ) : null}
          {presence !== 'live' ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center px-4 text-center text-sm text-white/80">
              {statusLine}
            </div>
          ) : (
            <p className="absolute bottom-3 left-3 z-10 rounded-md bg-black/40 px-2 py-1 text-xs text-white">{remoteName}</p>
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
          {localHandRaised ? (
            <p className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-amber-950">
              <Hand className="h-3 w-3" aria-hidden />
              Hand raised
            </p>
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
      {mediaNotice ? <p className="text-sm text-amber-200">{mediaNotice}</p> : null}
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
        <Button
          type="button"
          variant={localSharing ? 'primary' : 'outline'}
          aria-pressed={localSharing}
          aria-label={localSharing ? 'Stop sharing your screen' : 'Share your screen'}
          onClick={() => void toggleScreenShare()}
        >
          {localSharing ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          {localSharing ? 'Stop sharing' : 'Share screen'}
        </Button>
        {hasShare ? (
          <Button
            type="button"
            variant="outline"
            aria-label={focusScreen ? 'Show participant cameras' : 'Show shared screen'}
            onClick={() => setStageLayout(focusScreen ? 'camera' : hasShare ? 'screen' : 'auto')}
          >
            {focusScreen ? 'Show cameras' : 'Show shared screen'}
          </Button>
        ) : null}
        <Button
          type="button"
          variant={localHandRaised ? 'primary' : 'outline'}
          aria-pressed={localHandRaised}
          aria-label={localHandRaised ? 'Lower hand' : 'Raise hand'}
          onClick={() => void toggleHand()}
        >
          <Hand className="h-4 w-4" />
          {localHandRaised ? 'Lower hand' : 'Raise hand'}
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
