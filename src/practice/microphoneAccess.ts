export function requestPracticeMicrophone() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
}

export function microphoneFailureMessage(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Microphone access is required for the voice interview. Allow the microphone for this site, then choose Enable microphone.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect a microphone, or type your answer.'
  }
  return 'Microphone device unavailable or not found.'
}

export function microphoneStatusLabel(state: string, muted: boolean) {
  if (state === 'error') return 'Blocked — allow microphone access'
  if (state === 'speaking') return 'Interviewer is asking the question'
  if (state === 'evaluating') return 'Interviewer is moving to the next question'
  if (state === 'connecting') return 'Requesting microphone…'
  if (muted) return 'Muted (Audio paused)'
  if (state === 'listening' || state === 'idle') return 'Active (Listening for answer)'
  return 'Microphone unavailable'
}
