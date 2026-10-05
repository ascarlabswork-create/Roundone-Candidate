import { useEffect, useRef } from 'react'
import { microphoneStatusLabel } from '../../practice/microphoneAccess.ts'
import { practiceConversationLines } from '../../practice/conversationView.ts'
import type { PracticeTurn } from '../../practice/aiModel.ts'
import type { VoiceState } from '../../practice/voiceClient.ts'

type PracticeConversationProps = {
  interviewerName: string
  questionNumber: number
  totalQuestions: number
  turns: PracticeTurn[]
  currentQuestionId: string
  currentQuestion: string
  currentAnswer: string
  voiceState: VoiceState
  micMuted: boolean
  busy: boolean
  error: string | null
  persistError: string | null
  autoSubmitCountdown: number | null
  answerMax: number
  onAnswerChange: (value: string) => void
  onSubmit: () => void
  onMuteToggle: () => void
  onReplay: () => void
  onInterrupt: () => void
  onKeepSpeaking: () => void
  onEnd: () => void
  onEnableMicrophone: () => void
}

function statusCaption(state: VoiceState, muted: boolean) {
  if (state === 'speaking') return 'Speaking'
  if (state === 'listening') return muted ? 'Microphone off' : 'Listening'
  if (state === 'thinking' || state === 'evaluating') return 'Thinking'
  if (state === 'connecting') return 'Connecting'
  if (state === 'error') return 'Microphone needed'
  return muted ? 'Microphone off' : 'Ready'
}

export function PracticeConversation({
  interviewerName,
  questionNumber,
  totalQuestions,
  turns,
  currentQuestionId,
  currentQuestion,
  currentAnswer,
  voiceState,
  micMuted,
  busy,
  error,
  persistError,
  autoSubmitCountdown,
  answerMax,
  onAnswerChange,
  onSubmit,
  onMuteToggle,
  onReplay,
  onInterrupt,
  onKeepSpeaking,
  onEnd,
  onEnableMicrophone,
}: PracticeConversationProps) {
  const threadRef = useRef<HTMLDivElement>(null)
  const lines = practiceConversationLines(
    turns,
    { id: currentQuestionId, question: currentQuestion },
    currentAnswer,
  )
  const canSend = !busy && currentAnswer.trim().length >= 8
  const orbActive = voiceState === 'speaking' || voiceState === 'listening'

  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    thread.scrollTop = thread.scrollHeight
  }, [lines.length, currentAnswer, voiceState])

  return (
    <section className="mt-4 flex min-h-[70vh] flex-col overflow-hidden rounded-3xl bg-neutral-950 text-neutral-100 shadow-xl">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-medium text-white">{interviewerName}</p>
          <p className="text-xs text-neutral-400">
            Question {questionNumber} of {totalQuestions}
          </p>
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-white/10 hover:text-white"
        >
          End
        </button>
      </header>

      <div ref={threadRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6" aria-live="polite">
        {lines.map((line) =>
          line.role === 'candidate' ? (
            <div key={line.id} className="flex justify-end">
              <p
                className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed text-white ${
                  line.draft ? 'bg-blue-600/80' : 'bg-blue-600'
                }`}
              >
                {line.text}
              </p>
            </div>
          ) : (
            <div key={line.id} className="flex items-start gap-2">
              <p className="max-w-[90%] text-sm leading-relaxed text-neutral-100">{line.text}</p>
              {line.id === `q-${currentQuestionId}` ? (
                <button
                  type="button"
                  onClick={onReplay}
                  aria-label="Replay question"
                  className="mt-0.5 shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
                >
                  <SpeakerIcon />
                </button>
              ) : null}
            </div>
          ),
        )}
      </div>

      <div className="flex flex-col items-center px-4 pb-2">
        <div
          aria-hidden="true"
          className={`h-16 w-16 rounded-full bg-gradient-to-br from-sky-200 via-blue-300 to-indigo-400 shadow-[0_0_40px_rgba(147,197,253,0.45)] ${
            orbActive ? 'animate-pulse' : ''
          } ${voiceState === 'thinking' || voiceState === 'evaluating' ? 'opacity-70' : ''}`}
        />
        <p className="mt-3 text-xs text-neutral-400">{statusCaption(voiceState, micMuted)}</p>
        <p className="sr-only">{microphoneStatusLabel(voiceState, micMuted)}</p>
        {voiceState === 'speaking' ? (
          <button type="button" onClick={onInterrupt} className="mt-1 text-xs font-medium text-sky-300 hover:text-sky-200">
            Interrupt and speak
          </button>
        ) : null}
      </div>

      {autoSubmitCountdown != null && autoSubmitCountdown > 0 ? (
        <div className="mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs text-neutral-200">
          <span>Pausing. Sending in {autoSubmitCountdown}s.</span>
          <span className="flex gap-2">
            <button type="button" onClick={onKeepSpeaking} className="font-medium text-white hover:underline">
              Keep speaking
            </button>
            <button type="button" onClick={onSubmit} disabled={!canSend} className="font-medium text-sky-300 hover:underline">
              Send now
            </button>
          </span>
        </div>
      ) : null}

      {error ? <p className="px-5 pb-1 text-sm text-red-300">{error}</p> : null}
      {persistError ? <p className="px-5 pb-1 text-sm text-red-300">{persistError}</p> : null}

      <form
        className="flex items-center gap-2 px-3 py-3 sm:px-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSend) onSubmit()
        }}
      >
        <label className="sr-only" htmlFor="practice-conversation-draft">
          Your reply
        </label>
        <input
          id="practice-conversation-draft"
          value={currentAnswer}
          maxLength={answerMax}
          disabled={busy || voiceState === 'evaluating'}
          onChange={(event) => onAnswerChange(event.target.value.slice(0, answerMax))}
          placeholder={voiceState === 'error' ? 'Type your reply' : 'Type'}
          className="h-12 min-w-0 flex-1 rounded-full bg-neutral-800 px-4 text-sm text-white outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-sky-400"
        />
        {voiceState === 'error' ? (
          <button
            type="button"
            onClick={onEnableMicrophone}
            className="h-12 shrink-0 rounded-full bg-white px-3 text-xs font-semibold text-neutral-950"
          >
            Enable mic
          </button>
        ) : (
          <button
            type="button"
            onClick={onMuteToggle}
            aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              micMuted ? 'bg-red-500/20 text-red-200' : 'bg-neutral-800 text-neutral-200'
            }`}
          >
            {micMuted ? <MicOffIcon /> : <MicIcon />}
          </button>
        )}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send reply"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          <SendIcon />
        </button>
      </form>
    </section>
  )
}

function MicIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3v6a3 3 0 003 3z"
      />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636M12 18.75v3.75m-3.75 0h7.5"
      />
    </svg>
  )
}

function SpeakerIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  )
}
