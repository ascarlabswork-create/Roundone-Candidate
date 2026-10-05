import { requestRealtimeSession, requestSpeechAudio } from './aiAssist.ts'
import type { PracticeSetup } from './aiModel.ts'
import { microphoneFailureMessage, requestPracticeMicrophone } from './microphoneAccess.ts'
import { ANSWER_HOLD_MS, ANSWER_MIN_CHARS } from './voiceTurn.ts'

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'speaking'
  | 'listening'
  | 'thinking'
  | 'evaluating'
  | 'error'

export type VoiceClientCallbacks = {
  onStateChange: (state: VoiceState) => void
  onCandidateTranscript: (transcript: string, isFinal: boolean) => void
  onAiSpeakingProgress?: (transcriptDelta: string) => void
  onError: (error: string) => void
  onTurnComplete?: (finalCandidateText: string) => void
}

export class VoiceClient {
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private micStream: MediaStream | null = null
  private audioEl: HTMLAudioElement | null = null
  private ttsAudio: HTMLAudioElement | null = null
  private state: VoiceState = 'idle'
  private callbacks: VoiceClientCallbacks
  private isMuted = false
  private aiSpeaking = false
  private recognition: any = null
  private recognitionRunning = false
  private isUsingFallback = false
  private sessionActive = false

  // Accumulated speech transcript for the current answer.
  private accumulatedTranscript = ''

  // A thinking pause must not finish the answer. This fires only after a long silence.
  private silenceHoldTimer: number | null = null

  // Active voice for TTS
  private currentVoice = 'echo'

  constructor(callbacks: VoiceClientCallbacks) {
    this.callbacks = callbacks
  }

  getState(): VoiceState {
    return this.state
  }

  private setState(state: VoiceState) {
    this.state = state
    this.callbacks.onStateChange(state)
  }

  public setAccumulatedTranscript(text: string) {
    this.accumulatedTranscript = text
    this.flushRecognitionBuffer()
    this.startSilenceHold()
  }

  public getAccumulatedTranscript(): string {
    return this.accumulatedTranscript
  }

  public resetTurnTranscript() {
    this.accumulatedTranscript = ''
    this.cancelSilenceTimer()
    this.flushRecognitionBuffer()
  }

  // Restart the recognizer so its internal results buffer is cleared. Without
  // this, previously finalized words linger in event.results and can be
  // re-emitted after the candidate has cleared/edited the textbox.
  private flushRecognitionBuffer() {
    if (!this.isUsingFallback || !this.recognition) return
    this.stopRecognition()
    if (this.sessionActive && !this.aiSpeaking && !this.isMuted) {
      this.startRecognition()
    }
  }

  public cancelSilenceTimer() {
    if (this.silenceHoldTimer) {
      window.clearTimeout(this.silenceHoldTimer)
      this.silenceHoldTimer = null
    }
  }

  private startSilenceHold() {
    this.cancelSilenceTimer()
    if (this.aiSpeaking || this.state === 'evaluating') return
    if (this.accumulatedTranscript.trim().length < ANSWER_MIN_CHARS) return

    this.silenceHoldTimer = window.setTimeout(() => {
      this.silenceHoldTimer = null
      const textToSubmit = this.accumulatedTranscript.trim()
      if (textToSubmit.length >= ANSWER_MIN_CHARS && this.state !== 'evaluating' && !this.aiSpeaking) {
        this.setState('thinking')
        this.callbacks.onTurnComplete?.(textToSubmit)
      }
    }, ANSWER_HOLD_MS)
  }

  public appendTranscriptChunk(chunk: string) {
    // Half-duplex: ignore anything captured while the AI interviewer speaks.
    if (this.aiSpeaking) return
    const clean = chunk.trim()
    if (!clean) return

    if (this.accumulatedTranscript) {
      // Prevent repeating exact chunk if re-emitted
      if (!this.accumulatedTranscript.toLowerCase().endsWith(clean.toLowerCase())) {
        this.accumulatedTranscript = `${this.accumulatedTranscript} ${clean}`.trim()
      }
    } else {
      this.accumulatedTranscript = clean
    }

    this.callbacks.onCandidateTranscript(this.accumulatedTranscript, true)
  }

  async start(
    setup: PracticeSetup,
    voice = 'echo',
    interviewerName = 'John',
    existingStream?: MediaStream | null,
  ): Promise<boolean> {
    this.setState('connecting')
    this.currentVoice = voice

    const liveStream = existingStream?.getAudioTracks().some((track) => track.readyState === 'live')
      ? existingStream
      : null
    if (liveStream) {
      this.micStream = liveStream
    } else {
      try {
        this.micStream = await requestPracticeMicrophone()
      } catch (err: unknown) {
        this.setState('error')
        this.callbacks.onError(microphoneFailureMessage(err))
        return false
      }
    }

    this.sessionActive = true

    try {
      const secret = await requestRealtimeSession(setup, voice, interviewerName)
      if (secret) {
        const connected = await this.initWebRtc(secret)
        if (connected) return true
      }
    } catch {
      // Fall through to audio playback + speech recognition fallback
    }

    // Fallback mode using server TTS and browser STT
    return this.initFallback()
  }

  private async initWebRtc(clientSecret: string): Promise<boolean> {
    try {
      const pc = new RTCPeerConnection()
      this.peerConnection = pc

      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      this.audioEl = audioEl

      pc.ontrack = (event) => {
        if (this.audioEl && event.streams[0]) {
          this.audioEl.srcObject = event.streams[0]
        }
      }

      if (this.micStream) {
        this.micStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.micStream!)
        })
      }

      const dc = pc.createDataChannel('oai-events')
      this.dataChannel = dc

      dc.onopen = () => {
        this.setState('idle')
      }

      dc.onmessage = (event) => {
        this.handleRealtimeEvent(event.data)
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpUrl = 'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview'
      const sdpResponse = await fetch(sdpUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!sdpResponse.ok) {
        return false
      }

      const answerSdp = await sdpResponse.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      return true
    } catch {
      return false
    }
  }

  private handleRealtimeEvent(raw: string) {
    try {
      const event = JSON.parse(raw)
      const type = event.type as string

      if (type === 'output_audio_buffer.started' || type === 'response.audio.started') {
        // AI interviewer started talking -> take the floor (half-duplex).
        this.beginAiSpeaking()
        this.setState('speaking')
      } else if (type === 'output_audio_buffer.stopped' || type === 'response.audio.done') {
        // AI interviewer finished -> hand the floor back to the candidate.
        this.endAiSpeaking()
      } else if (type === 'input_audio_buffer.speech_started') {
        // Candidate continued after a pause. Keep the same answer.
        this.cancelSilenceTimer()
        if (!this.aiSpeaking) {
          this.setState('listening')
        }
      } else if (type === 'input_audio_buffer.speech_stopped') {
        // A pause starts the wait. Speaking again cancels it and keeps this answer.
        if (!this.aiSpeaking) {
          this.startSilenceHold()
        }
      } else if (type === 'conversation.item.input_audio_transcription.completed') {
        const transcript = event.transcript?.trim()
        if (transcript && !this.aiSpeaking) {
          this.appendTranscriptChunk(transcript)
          this.startSilenceHold()
        }
      } else if (type === 'response.audio_transcript.delta') {
        if (this.callbacks.onAiSpeakingProgress && event.delta) {
          this.callbacks.onAiSpeakingProgress(event.delta)
        }
      }
    } catch {
      // Ignore non-json
    }
  }

  private initFallback(): boolean {
    this.isUsingFallback = true
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          // Half-duplex: while the interviewer is speaking the mic may still
          // pick up the AI's own voice through the speakers. Discard it so the
          // candidate transcript never fills with the interviewer's words.
          if (this.aiSpeaking || this.isMuted) return

          // Only process results that are NEW in this event (from resultIndex
          // forward). This is the key fix: we no longer rebuild the transcript
          // from every result in the session, so cleared/edited text stays
          // cleared and words are never duplicated ("yellow yellow yellow").
          let newFinal = ''
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const part = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              newFinal += part + ' '
            } else {
              interim += part
            }
          }

          if (newFinal.trim()) {
            this.accumulatedTranscript = this.accumulatedTranscript
              ? `${this.accumulatedTranscript} ${newFinal.trim()}`.trim()
              : newFinal.trim()
          }

          const display = `${this.accumulatedTranscript}${
            interim.trim() ? ` ${interim.trim()}` : ''
          }`.trim()

          if (display) {
            this.callbacks.onCandidateTranscript(display, Boolean(newFinal.trim() && !interim.trim()))
            if (this.state !== 'evaluating') {
              this.setState('listening')
            }
            // Fresh speech cancels the wait and keeps this same answer.
            this.startSilenceHold()
          }
        }

        recognition.onerror = (event: { error?: string }) => {
          const code = event?.error
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            this.setState('error')
            this.callbacks.onError(microphoneFailureMessage(Object.assign(new Error(code), { name: 'NotAllowedError' })))
            return
          }
          if (code === 'audio-capture') {
            this.setState('error')
            this.callbacks.onError(microphoneFailureMessage(Object.assign(new Error(code), { name: 'NotFoundError' })))
          }
        }

        recognition.onend = () => {
          this.recognitionRunning = false
          // Restart only while actively listening: not while the AI is
          // speaking, not while muted, and not after the session closed.
          if (
            this.sessionActive &&
            !this.aiSpeaking &&
            !this.isMuted &&
            this.isUsingFallback &&
            this.state !== 'error'
          ) {
            this.startRecognition()
          }
        }

        this.recognition = recognition
        this.startRecognition()
      } catch {
        // SpeechRecognition start error
      }
    }

    this.setState('idle')
    return true
  }

  private startRecognition() {
    if (!this.recognition || this.recognitionRunning) return
    try {
      this.recognition.start()
      this.recognitionRunning = true
    } catch {
      // Already started; ignore.
    }
  }

  private stopRecognition() {
    if (!this.recognition) return
    try {
      this.recognition.stop()
    } catch {
      // Ignore
    }
    this.recognitionRunning = false
  }

  // Interviewer takes the floor: stop capturing the candidate entirely.
  private beginAiSpeaking() {
    this.aiSpeaking = true
    this.cancelSilenceTimer()
    this.stopRecognition()
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = false
      })
    }
  }

  // Interviewer yields the floor: resume listening to the candidate (unless
  // the candidate manually muted their mic).
  private endAiSpeaking() {
    this.aiSpeaking = false
    if (this.state !== 'evaluating') {
      this.setState('listening')
    }
    if (this.sessionActive && !this.isMuted) {
      if (this.micStream) {
        this.micStream.getAudioTracks().forEach((track) => {
          track.enabled = true
        })
      }
      if (this.isUsingFallback) {
        this.startRecognition()
      }
    }
  }

  private stopAudioPlayback() {
    if (this.audioEl) {
      this.audioEl.pause()
      this.audioEl.currentTime = 0
    }
    if (this.ttsAudio) {
      this.ttsAudio.pause()
      this.ttsAudio = null
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'response.cancel' }))
      } catch {
        // Ignore
      }
    }
  }

  async speakQuestion(questionText: string, voice?: string): Promise<void> {
    // Take the floor for the interviewer: stop the candidate mic + STT so the
    // AI's own audio is never captured, then start speaking.
    this.stopAudioPlayback()
    this.beginAiSpeaking()
    this.setState('speaking')
    const activeVoice = voice || this.currentVoice || 'echo'

    // If WebRTC data channel is connected, we send conversation item
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'input_text',
                  text: questionText,
                },
              ],
            },
          }),
        )
        this.dataChannel.send(
          JSON.stringify({
            type: 'response.create',
          }),
        )
        return
      } catch {
        // Fall back to server TTS
      }
    }

    // Server TTS fallback with chosen voice
    try {
      const audioBase64 = await requestSpeechAudio(questionText, activeVoice)
      if (audioBase64) {
        const audioSrc = `data:audio/mp3;base64,${audioBase64}`
        const audio = new Audio(audioSrc)
        this.ttsAudio = audio

        audio.onended = () => {
          this.ttsAudio = null
          this.endAiSpeaking()
        }

        audio.onerror = () => {
          this.ttsAudio = null
          this.endAiSpeaking()
        }

        await audio.play()
        return
      }
    } catch {
      // Fall through to browser SpeechSynthesis
    }

    // Browser SpeechSynthesis fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(questionText)
      utterance.rate = 1.0
      utterance.pitch = 1.0

      // Match female pitch/voice if shimmer or nova
      if (activeVoice === 'shimmer' || activeVoice === 'nova') {
        utterance.pitch = 1.15
      }

      utterance.onend = () => {
        this.endAiSpeaking()
      }
      utterance.onerror = () => {
        this.endAiSpeaking()
      }
      window.speechSynthesis.speak(utterance)
      return
    }

    this.endAiSpeaking()
  }

  interruptAiSpeech() {
    this.stopAudioPlayback()
    // Hand the floor back to the candidate immediately.
    if (this.aiSpeaking) {
      this.endAiSpeaking()
    } else if (this.state === 'speaking') {
      this.setState('listening')
    }
  }

  muteMicrophone(mute: boolean) {
    this.isMuted = mute
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        // Stay disabled while the AI is speaking regardless of manual state.
        track.enabled = !mute && !this.aiSpeaking
      })
    }
    if (this.isUsingFallback) {
      if (mute) {
        this.stopRecognition()
      } else if (!this.aiSpeaking) {
        this.startRecognition()
      }
    }
  }

  getIsMuted(): boolean {
    return this.isMuted
  }

  close() {
    this.sessionActive = false
    this.aiSpeaking = false
    this.stopAudioPlayback()
    this.cancelSilenceTimer()

    if (this.recognition) {
      this.recognitionRunning = false
      try {
        this.recognition.stop()
      } catch {
        // Ignore
      }
      this.recognition = null
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop())
      this.micStream = null
    }

    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.audioEl = null
    this.setState('idle')
  }
}
