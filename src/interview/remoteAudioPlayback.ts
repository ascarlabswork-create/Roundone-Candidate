/** Playback rules for a remote LiveKit microphone. Independent of video. */

export const REMOTE_AUDIO_VOLUME = 1

export function isRemoteAudioKind(kind: string): boolean {
  return kind === 'audio'
}

/** Audio publications must be subscribed even when a video track is already showing. */
export function needsAudioSubscription(kind: string, isSubscribed: boolean): boolean {
  return isRemoteAudioKind(kind) && !isSubscribed
}

/** Chrome and Safari block element.play() until a user gesture calls room.startAudio(). */
export function playbackNeedsUserGesture(canPlaybackAudio: boolean): boolean {
  return !canPlaybackAudio
}

export function applyRemoteAudioElement(element: {
  autoplay: boolean
  muted: boolean
  volume: number
}): void {
  element.autoplay = true
  element.muted = false
  element.volume = REMOTE_AUDIO_VOLUME
}

export function rememberRemoteAudioTrack<T extends { sid?: string }>(current: T[], track: T): T[] {
  if (track.sid && current.some((item) => item.sid === track.sid)) return current
  return [...current, track]
}

export function forgetRemoteAudioTrack<T extends { sid?: string }>(current: T[], sid: string): T[] {
  return current.filter((item) => item.sid !== sid)
}
