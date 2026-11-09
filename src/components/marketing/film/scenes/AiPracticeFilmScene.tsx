import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PracticeConversation } from '../../../practice/PracticeConversation.tsx'
import type { VoiceState } from '../../../../practice/voiceClient.ts'

const QUESTION =
  'Tell me about a time you led a cross-functional project. What was the outcome, and what would you do differently?'

const TYPED_ANSWER =
  'I aligned design and backend on a two-week release window, cut scope to an MVP, and shipped on time with a 12% lift in activation…'

export function AiPracticeFilmScene() {
  const [voiceState, setVoiceState] = useState<VoiceState>('speaking')
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    const sequence: { delay: number; state: VoiceState; answer?: string }[] = [
      { delay: 0, state: 'speaking', answer: '' },
      { delay: 3200, state: 'idle', answer: '' },
      { delay: 4200, state: 'listening', answer: '' },
      { delay: 4800, state: 'listening', answer: TYPED_ANSWER.slice(0, 40) },
      { delay: 6200, state: 'listening', answer: TYPED_ANSWER.slice(0, 95) },
      { delay: 7800, state: 'listening', answer: TYPED_ANSWER },
      { delay: 10500, state: 'evaluating', answer: TYPED_ANSWER },
      { delay: 12500, state: 'speaking', answer: TYPED_ANSWER },
    ]
    const timers = sequence.map(({ delay, state, answer: nextAnswer }) =>
      window.setTimeout(() => {
        setVoiceState(state)
        if (nextAnswer != null) setAnswer(nextAnswer)
      }, delay),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  return (
    <div className="flex h-full min-h-[720px] flex-col bg-gradient-to-br from-[#0a0f1a] via-[#101c35] to-[#312e81] p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 text-sky-200/90">
        <Sparkles className="h-4 w-4 text-violet-300" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">AI mock interview · Live product UI</p>
      </div>
      <div className="mx-auto mt-4 w-full max-w-6xl flex-1">
        <PracticeConversation
          interviewerName="Jordan Lee"
          interviewerTitle="Senior engineering manager · AI persona"
          targetRole="Backend Engineer"
          skills={['System Design', 'Python', 'AWS']}
          questionNumber={2}
          totalQuestions={5}
          currentQuestion={QUESTION}
          currentAnswer={answer}
          voiceState={voiceState}
          micMuted={false}
          busy={voiceState === 'evaluating'}
          error={null}
          persistError={null}
          answerMax={2000}
          onAnswerChange={setAnswer}
          onLeave={() => undefined}
          onEnableMicrophone={() => undefined}
        />
      </div>
      {voiceState === 'evaluating' || voiceState === 'speaking' ? (
        <div className="mx-auto mt-4 grid w-full max-w-md grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/40 p-3 text-center backdrop-blur-md">
          {[
            { label: 'Structure', score: 88 },
            { label: 'Depth', score: 82 },
            { label: 'Clarity', score: 91 },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="text-lg font-bold text-emerald-300">{item.score}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
