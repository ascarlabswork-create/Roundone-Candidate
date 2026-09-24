import { requestRealtimeSession, requestSpeechAudio } from './aiAssist.ts'
import type { PracticeSetup } from './aiModel.ts'

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
  private recognition: any = null
  private isUsingFallback = false
  private currentTranscript = ''
  private speechTimeout: number | null = null

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

  async start(setup: PracticeSetup): Promise<boolean> {
    this.setState('connecting')

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err: unknown) {
      const errName = (err as Error)?.name || ''
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        this.setState('error')
        this.callbacks.onError('Microphone access is required for the voice interview.')
        return false
      }
      this.setState('error')
      this.callbacks.onError('Microphone device unavailable or not found.')
      return false
    }

    try {
      const secret = await requestRealtimeSession(setup)
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
        this.setState('speaking')
      } else if (type === 'output_audio_buffer.stopped' || type === 'response.audio.done') {
        this.setState('listening')
      } else if (type === 'input_audio_buffer.speech_started') {
        // Barge-in: candidate started speaking while AI was talking
        if (this.state === 'speaking') {
          this.interruptAiSpeech()
        }
        this.setState('listening')
      } else if (type === 'input_audio_buffer.speech_stopped') {
        this.setState('thinking')
      } else if (type === 'conversation.item.input_audio_transcription.completed') {
        const transcript = event.transcript?.trim()
        if (transcript) {
          this.currentTranscript = transcript
          this.callbacks.onCandidateTranscript(transcript, true)
          if (this.callbacks.onTurnComplete) {
            this.callbacks.onTurnComplete(transcript)
          }
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
          let interim = ''
          let final = ''

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const part = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              final += part
            } else {
              interim += part
            }
          }

          const combined = (final || interim).trim()
          if (combined) {
            this.currentTranscript = combined
            this.callbacks.onCandidateTranscript(combined, Boolean(final))

            // Barge-in: candidate starts speaking during TTS
            if (this.state === 'speaking') {
              this.interruptAiSpeech()
            }

            if (this.state !== 'speaking' && this.state !== 'evaluating') {
              this.setState('listening')
            }

            // Reset silence timer for automatic turn end
            if (this.speechTimeout) window.clearTimeout(this.speechTimeout)
            this.speechTimeout = window.setTimeout(() => {
              if (this.currentTranscript.length >= 6 && this.state === 'listening') {
                this.setState('thinking')
                if (this.callbacks.onTurnComplete) {
                  this.callbacks.onTurnComplete(this.currentTranscript)
                }
              }
            }, 1800)
          }
        }

        recognition.onerror = () => {
          // Keep listening or allow candidate to continue
        }

        recognition.onend = () => {
          // Restart recognition if session still active
          if (this.state !== 'idle' && this.state !== 'error' && this.isUsingFallback) {
            try {
              recognition.start()
            } catch {
              // Ignore if already running
            }
          }
        }

        this.recognition = recognition
        recognition.start()
      } catch {
        // SpeechRecognition start error
      }
    }

    this.setState('idle')
    return true
  }

  async speakQuestion(questionText: string): Promise<void> {
    this.interruptAiSpeech()
    this.setState('speaking')

    // If WebRTC data channel is connected, we can send conversation item
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

    // Server TTS fallback
    try {
      const audioBase64 = await requestSpeechAudio(questionText)
      if (audioBase64) {
        const audioSrc = `data:audio/mp3;base64,${audioBase64}`
        const audio = new Audio(audioSrc)
        this.ttsAudio = audio

        audio.onended = () => {
          this.ttsAudio = null
          this.setState('listening')
        }

        audio.onerror = () => {
          this.ttsAudio = null
          this.setState('listening')
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
      utterance.onend = () => {
        this.setState('listening')
      }
      utterance.onerror = () => {
        this.setState('listening')
      }
      window.speechSynthesis.speak(utterance)
      return
    }

    this.setState('listening')
  }

  interruptAiSpeech() {
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

    if (this.state === 'speaking') {
      this.setState('listening')
    }
  }

  muteMicrophone(mute: boolean) {
    this.isMuted = mute
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !mute
      })
    }
  }

  getIsMuted(): boolean {
    return this.isMuted
  }

  close() {
    this.interruptAiSpeech()

    if (this.speechTimeout) {
      window.clearTimeout(this.speechTimeout)
      this.speechTimeout = null
    }

    if (this.recognition) {
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
