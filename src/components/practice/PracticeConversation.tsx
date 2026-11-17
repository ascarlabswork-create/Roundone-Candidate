import { Mic, MicOff } from 'lucide-react'
import { microphoneStatusLabel } from '../../practice/microphoneAccess.ts'
import type { VoiceState } from '../../practice/voiceClient.ts'

type PracticeConversationProps = {
  interviewerName: string
  interviewerTitle: string
  targetRole: string
  skills: string[]
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

function interviewerStatus(state: VoiceState, interviewerName: string) {
  if (state === 'speaking') return `${interviewerName} is speaking`
  if (state === 'thinking' || state === 'evaluating') return `${interviewerName} is thinking`
  if (state === 'connecting') return 'Joining…'
  if (state === 'listening' || state === 'idle') return 'Listening to you'
  if (state === 'error') return 'Waiting for microphone'
  return 'Listening to you'
}

function candidateStatus(state: VoiceState) {
  if (state === 'listening' || state === 'idle') return 'Your turn — answer out loud'
  if (state === 'speaking') return 'Listening'
  if (state === 'thinking' || state === 'evaluating') return 'Waiting'
  if (state === 'connecting') return 'Joining…'
  if (state === 'error') return 'Microphone needed'
  return 'Listening'
}

export function PracticeConversation({
  interviewerName,
  interviewerTitle,
  targetRole,
  skills,
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
  const isSpeaking = voiceState === 'speaking'
  const isThinking = voiceState === 'thinking' || voiceState === 'evaluating'
  const isConnecting = voiceState === 'connecting'
  const interviewerSpeaking = interviewerHasFloor(voiceState)
  const yourTurn = voiceState === 'listening' || voiceState === 'idle'
  const showQuestionFallback = voiceState === 'error'
  const micOff = micMuted || voiceState === 'error'
  const topicLine = [targetRole.trim(), ...skills.slice(0, 4)].filter(Boolean).join(' · ')
  const progressPct = totalQuestions > 0 ? Math.min(100, Math.round((questionNumber / totalQuestions) * 100)) : 0

  return (
    <section className="practice-call-enter mt-4 flex min-h-[78vh] flex-col overflow-hidden rounded-3xl bg-neutral-950 text-neutral-100 shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            One-to-one AI interview · Question {questionNumber} of {totalQuestions}
          </p>
          {topicLine ? (
            <p className="mt-1 truncate text-sm font-medium text-neutral-200" title={topicLine}>
              Interviewing for {topicLine}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-white/10 hover:text-white"
        >
          Leave
        </button>
      </header>

      <div className="h-1 w-full bg-white/5" aria-hidden>
        <div
          className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400 transition-[width] duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="relative grid flex-1 gap-3 p-3 sm:grid-cols-[minmax(0,1.55fr)_minmax(200px,0.7fr)] sm:p-4">
        <ParticipantTile
          name={interviewerName}
          detail={interviewerTitle}
          active={voiceState === 'speaking'}
          status={interviewerStatus(voiceState, interviewerName)}
          large
          speaking={voiceState === 'speaking'}
        />
        <ParticipantTile
          name="You"
          detail={targetRole.trim() || 'Candidate'}
          active={yourTurn}
          status={candidateStatus(voiceState)}
          speaking={yourTurn && Boolean(currentAnswer.trim())}
          showMicBadge={micOff}
        />
      </div>

      <p className="sr-only">{currentQuestion}</p>

      <div className="border-t border-white/10 px-4 py-4 sm:px-6">
        {showQuestionFallback ? (
          <p className="text-sm leading-relaxed text-neutral-200">{currentQuestion}</p>
        ) : isSpeaking ? (
          <div className="flex items-center gap-3">
            <SpeakingBars />
            <p className="text-sm text-neutral-300">
              {interviewerName} is speaking. Listen, then answer when it is your turn.
            </p>
          </div>
        ) : isThinking || isConnecting ? (
          <div className="flex items-center gap-3">
            <ThinkingDots />
            <p className="text-sm text-neutral-300">
              {isConnecting ? 'Connecting your live interview…' : `${interviewerName} is thinking about your answer…`}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-400">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Your turn
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                {micOff ? (
                  <MicOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                    <ListeningWave />
                  </span>
                )}
                Mic {micOff ? 'off' : 'live'}
              </span>
            </div>
            <textarea
              id="practice-live-answer"
              aria-label="Your spoken answer"
              value={currentAnswer}
              maxLength={answerMax}
              disabled={busy || interviewerSpeaking}
              onChange={(event) => onAnswerChange(event.target.value.slice(0, answerMax))}
              placeholder={'Speak your answer. Say "I don\'t know" or stay quiet to move on. Ask to repeat if you need the question again.'}
              className="mt-2 min-h-16 w-full resize-none bg-transparent text-base leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-500 sm:text-sm"
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

function SpeakingBars() {
  return (
    <span className="inline-flex h-5 items-end gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className="practice-eq-bar w-1 rounded-full bg-gradient-to-t from-sky-500 to-sky-300"
          style={{ animationDelay: `${index * 110}ms` }}
        />
      ))}
    </span>
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="practice-think-dot h-2 w-2 rounded-full bg-indigo-300"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  )
}

function ListeningWave() {
  return (
    <span className="inline-flex h-3 items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="practice-eq-bar w-0.5 rounded-full bg-emerald-400"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </span>
  )
}

function ParticipantTile({
  name,
  detail,
  active,
  status,
  large = false,
  speaking = false,
  showMicBadge = false,
}: {
  name: string
  detail: string
  active: boolean
  status?: string
  large?: boolean
  speaking?: boolean
  showMicBadge?: boolean
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className={`relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-2xl bg-neutral-900 px-4 py-8 text-center ring-1 transition-all duration-500 ${
        active ? 'ring-sky-400/70 shadow-[0_0_24px_rgba(56,189,248,0.22)]' : 'ring-white/5'
      } ${large ? 'min-h-64 sm:min-h-72' : ''}`}
    >
      {speaking ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_62%)] motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}
      <div className="relative">
        {active ? (
          <span
            className="practice-avatar-ring pointer-events-none absolute inset-0 rounded-full"
            aria-hidden
          />
        ) : null}
        <div
          aria-hidden="true"
          className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-sky-200 via-blue-400 to-indigo-500 font-semibold text-navy-950 transition-all duration-500 ${
            large ? 'h-28 w-28 text-3xl' : 'h-20 w-20 text-2xl'
          } ${speaking ? 'shadow-[0_0_0_10px_rgba(56,189,248,0.18)] motion-safe:animate-[practice-avatar-bob_1.6s_ease-in-out_infinite]' : 'opacity-90'}`}
        >
          {initial}
        </div>
      </div>
      <p className="relative mt-4 text-base font-medium text-white">{name}</p>
      <p className="relative mt-1 text-xs text-neutral-500">{detail}</p>
      {status ? (
        <p
          className={`relative mt-3 rounded-full px-3 py-1 text-xs font-medium ${
            active ? 'bg-sky-500/20 text-sky-100' : 'bg-white/5 text-neutral-300'
          }`}
        >
          {status}
        </p>
      ) : null}
      {showMicBadge ? (
        <span className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90 text-white">
          <MicOff className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
    </div>
  )
}
