import {
  applyRemoteAudioElement,
  forgetRemoteAudioTrack,
  isRemoteAudioKind,
  needsAudioSubscription,
  playbackNeedsUserGesture,
  rememberRemoteAudioTrack,
  REMOTE_AUDIO_VOLUME,
} from './remoteAudioPlayback.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(isRemoteAudioKind('audio'), 'audio kind is remote audio')
expect(!isRemoteAudioKind('video'), 'video is not treated as remote audio')

expect(needsAudioSubscription('audio', false), 'unsubscribed microphone is subscribed')
expect(!needsAudioSubscription('audio', true), 'subscribed microphone is left alone')
expect(!needsAudioSubscription('video', false), 'video subscription is not changed here')

expect(playbackNeedsUserGesture(false), 'blocked playback asks for a gesture')
expect(!playbackNeedsUserGesture(true), 'allowed playback does not ask for a gesture')

const element = { autoplay: false, muted: true, volume: 0 }
applyRemoteAudioElement(element)
expect(element.autoplay, 'remote audio autoplays')
expect(!element.muted, 'remote audio is not muted')
expect(element.volume === REMOTE_AUDIO_VOLUME, 'remote audio volume is full')

const first = { sid: 'mic-1' }
const remembered = rememberRemoteAudioTrack([], first)
expect(remembered.length === 1 && remembered[0] === first, 'subscribed microphone is kept')
expect(rememberRemoteAudioTrack(remembered, first).length === 1, 'the same microphone is not duplicated')
expect(forgetRemoteAudioTrack(remembered, 'mic-1').length === 0, 'unsubscribed microphone is removed')

console.log('remote audio playback checks passed')
