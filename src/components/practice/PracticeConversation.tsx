import { microphoneStatusLabel } from '../../practice/microphoneAccess.ts'
import type { VoiceState } from '../../practice/voiceClient.ts'

type PracticeConversationProps = {
  interviewerName: string
  interviewerTitle: string
  questionNumber: number
  totalQuestions: number
  currentQuestion: string
  currentAnswer: string
  voiceState: VoiceState
  micMuted: boolean
  busy: boolean
  error: string | null
  persistError: string | null
  answerMax: number
  onAnswerChange: (value: string) => void
  onLeave: () => void
  onEnableMicrophone: () => void
}

function roomStatus(state: VoiceState) {
  if (state === 'speaking') return 'Asking the question'
  if (state === 'listening' || state === 'idle') return 'Listening'
  if (state === 'thinking' || state === 'evaluating') return 'Moving to the next question'
  if (state === 'connecting') return 'Joining the interview'
  if (state === 'error') return 'Microphone needed'
  return 'Listening'
}

export function PracticeConversation({
  interviewerName,
  interviewerTitle,
  questionNumber,
  totalQuestions,
  currentQuestion,
  currentAnswer,
  voiceState,
  micMuted,
  busy,
  error,
  persistError,
  answerMax,
  onAnswerChange,
  onLeave,
  onEnableMicrophone,
}: PracticeConversationProps) {
  const interviewerHasFloor = voiceState === 'speaking' || voiceState === 'thinking' || voiceState === 'evaluating'
  const orbActive = voiceState === 'speaking' || voiceState === 'listening'

  return (
    <section className="mt-4 flex min-h-[70vh] flex-col rounded-3xl bg-neutral-950 px-5 py-5 text-neutral-100 shadow-xl sm:px-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{interviewerName}</p>
          <p className="text-xs text-neutral-400">
            {interviewerTitle} · Question {questionNumber} of {totalQuestions}
          </p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-white/10 hover:text-white"
        >
          Leave
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <div
          aria-hidden="true"
          className={`h-24 w-24 rounded-full bg-gradient-to-br from-sky-200 via-blue-400 to-indigo-500 shadow-[0_0_48px_rgba(147,197,253,0.35)] ${
            orbActive ? 'animate-pulse' : 'opacity-80'
          }`}
        />
        <p className="mt-4 text-sm text-neutral-300">{roomStatus(voiceState)}</p>
        <p className="sr-only">{microphoneStatusLabel(voiceState, micMuted)}</p>
        <h1 className="mt-8 max-w-2xl text-xl font-medium leading-relaxed text-white sm:text-2xl">{currentQuestion}</h1>
      </div>

      <div className="pb-2">
        <label htmlFor="practice-live-answer" className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Your answer
        </label>
        <textarea
          id="practice-live-answer"
          value={currentAnswer}
          maxLength={answerMax}
          disabled={busy || interviewerHasFloor}
          onChange={(event) => onAnswerChange(event.target.value.slice(0, answerMax))}
          placeholder={
            interviewerHasFloor
              ? 'Listen to the question, then answer in your own time.'
              : 'Speak your answer. A pause to think will not end it.'
          }
          className="mt-2 min-h-28 w-full resize-none bg-transparent text-sm leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        <p className="text-xs text-neutral-500">
          Pause to think, then keep talking. The same answer continues until you have finished.
        </p>
        {voiceState === 'error' ? (
          <button
            type="button"
            onClick={onEnableMicrophone}
            className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-950"
          >
            Enable microphone
          </button>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {persistError ? <p className="mt-2 text-sm text-red-300">{persistError}</p> : null}
      </div>
    </section>
  )
}
