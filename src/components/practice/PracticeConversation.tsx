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

function interviewerHasFloor(state: VoiceState) {
  return state === 'speaking' || state === 'thinking' || state === 'evaluating' || state === 'connecting'
}

function floorCopy(state: VoiceState, interviewerName: string) {
  if (state === 'speaking') return `${interviewerName} is speaking`
  if (state === 'listening' || state === 'idle') return 'Your turn'
  if (state === 'thinking' || state === 'evaluating') return `${interviewerName} is thinking`
  if (state === 'connecting') return 'Joining the interview'
  if (state === 'error') return 'Microphone needed'
  return 'Your turn'
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
  const interviewerSpeaking = interviewerHasFloor(voiceState)
  const youSpeaking = voiceState === 'listening' || voiceState === 'idle'
  const showQuestionFallback = voiceState === 'error'

  return (
    <section className="mt-4 flex min-h-[78vh] flex-col overflow-hidden rounded-3xl bg-neutral-950 text-neutral-100 shadow-xl">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <p className="text-xs text-neutral-400">
          {questionNumber} of {totalQuestions}
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-white/10 hover:text-white"
        >
          Leave
        </button>
      </header>

      <div className="grid flex-1 gap-3 px-4 pb-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.7fr)] sm:px-6">
        <ParticipantTile
          name={interviewerName}
          detail={interviewerTitle}
          active={voiceState === 'speaking'}
          status={floorCopy(voiceState, interviewerName)}
          large
        />
        <ParticipantTile
          name="You"
          detail="Candidate"
          active={youSpeaking}
          status={youSpeaking ? 'Your turn' : 'Listening'}
        />
      </div>

      <p className="sr-only">{currentQuestion}</p>

      <div className="border-t border-white/10 px-5 py-4 sm:px-6">
        {showQuestionFallback ? (
          <p className="text-sm leading-relaxed text-neutral-200">{currentQuestion}</p>
        ) : interviewerSpeaking ? (
          <p className="text-sm text-neutral-300">{floorCopy(voiceState, interviewerName)}. Listen, then answer out loud.</p>
        ) : (
          <>
            <p className="text-xs text-neutral-500">You</p>
            <textarea
              id="practice-live-answer"
              aria-label="Your spoken answer"
              value={currentAnswer}
              maxLength={answerMax}
              disabled={busy || interviewerSpeaking}
              onChange={(event) => onAnswerChange(event.target.value.slice(0, answerMax))}
              placeholder="Speak your answer. A pause to think will not end it."
              className="mt-1 min-h-16 w-full resize-none bg-transparent text-sm leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-500"
            />
          </>
        )}
        <p className="sr-only">{microphoneStatusLabel(voiceState, micMuted)}</p>
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

function ParticipantTile({
  name,
  detail,
  active,
  status,
  large = false,
}: {
  name: string
  detail: string
  active: boolean
  status?: string
  large?: boolean
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-neutral-900 px-4 py-8 text-center">
      <div
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-sky-200 via-blue-400 to-indigo-500 font-semibold text-navy-950 shadow-[0_0_48px_rgba(147,197,253,0.28)] ${
          large ? 'h-28 w-28 text-3xl' : 'h-20 w-20 text-2xl'
        } ${active ? 'animate-pulse' : 'opacity-80'}`}
      >
        {initial}
      </div>
      <p className="mt-4 text-base font-medium text-white">{name}</p>
      <p className="mt-1 text-xs text-neutral-500">{detail}</p>
      {status ? <p className="mt-2 text-sm text-neutral-200">{status}</p> : null}
    </div>
  )
}
