import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Badge, Card, FieldLabel, PageHeader, TextArea } from '../components/ui/primitives.tsx'
import {
  PRACTICE_DRILLS,
  coverageForAnswer,
  isAttemptedAnswer,
  practiceTypeFromSlug,
  practiceTypeSlug,
  type PracticeDrill,
  type PracticeQuestion,
} from '../data/practiceDrills.ts'
import { INTERVIEW_TYPES } from '../data/catalogs.ts'

type SessionAnswer = {
  questionId: string
  text: string
  covered: string[]
  missed: string[]
}

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds)
  const mm = String(Math.floor(clamped / 60)).padStart(2, '0')
  const ss = String(clamped % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function emptyAnswers(drill: PracticeDrill): Record<string, string> {
  return Object.fromEntries(drill.questions.map((question) => [question.id, question.starterCode ?? '']))
}

export function PracticePage() {
  const { type: typeSlug } = useParams()
  const navigate = useNavigate()
  const selectedType = practiceTypeFromSlug(typeSlug)

  if (typeSlug && !selectedType) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader title="Practice session not found" subtitle="Pick a drill from AI Practice to start a timed session." />
        <div className="mt-8">
          <Link to="/candidate/practice">
            <Button>Back to AI Practice</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!selectedType) {
    return <PracticeHub />
  }

  return <PracticeSession drill={PRACTICE_DRILLS[selectedType]} onExit={() => navigate('/candidate/practice')} />
}

function PracticeHub() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        title="AI Practice"
        subtitle="Start a timed warm-up with real interview prompts, a notes pane, and a recap. Live mocks still happen with a human interviewer."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {INTERVIEW_TYPES.map((type) => {
          const drill = PRACTICE_DRILLS[type]
          return (
            <Card key={type} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-navy-950">{type} drill</h2>
                <Badge tone="blue">{drill.durationMin} min</Badge>
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-600">{drill.summary}</p>
              <p className="mt-3 text-xs text-slate-500">{drill.questions.length} prompts · notes + recap</p>
              <div className="mt-4">
                <Link to={`/candidate/practice/${practiceTypeSlug(type)}`}>
                  <Button fullWidth>Start session</Button>
                </Link>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="mt-8">
        <Link to="/candidate/find">
          <Button variant="outline">Find a human interviewer instead</Button>
        </Link>
      </div>
    </div>
  )
}

function PracticeSession({ drill, onExit }: { drill: PracticeDrill; onExit: () => void }) {
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [notes, setNotes] = useState('')
  const [checked, setChecked] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>(() => emptyAnswers(drill))
  const [recap, setRecap] = useState<SessionAnswer[]>([])
  const [remaining, setRemaining] = useState(drill.durationMin * 60)

  const question = drill.questions[index] ?? drill.questions[0]
  const answerText = question ? (answers[question.id] ?? '') : ''
  const recapRef = useRef(recap)
  const answersRef = useRef(answers)
  const finishingRef = useRef(false)
  recapRef.current = recap
  answersRef.current = answers

  const coverage = useMemo(
    () => (revealed && question ? coverageForAnswer(answerText, question.expectedPoints) : null),
    [answerText, question, revealed],
  )

  function scoredAnswer(item: PracticeQuestion, text: string): SessionAnswer {
    const points = coverageForAnswer(text, item.expectedPoints)
    return { questionId: item.id, text, covered: points.covered, missed: points.missed }
  }

  function finishSession(
    currentRecap: SessionAnswer[] = recapRef.current,
    currentAnswers: Record<string, string> = answersRef.current,
  ) {
    if (finishingRef.current) return
    finishingRef.current = true
    const completedIds = new Set(currentRecap.map((item) => item.questionId))
    const pending = drill.questions
      .filter((item) => !completedIds.has(item.id) && isAttemptedAnswer(item, currentAnswers[item.id] ?? ''))
      .map((item) => scoredAnswer(item, currentAnswers[item.id] ?? ''))
    setRecap([...currentRecap, ...pending])
    setDone(true)
  }

  useEffect(() => {
    if (!started || done) return
    const id = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [done, started])

  useEffect(() => {
    if (started && remaining === 0 && !done) finishSession()
  }, [done, remaining, started])

  function submitCurrent() {
    if (!question) return
    const next = scoredAnswer(question, answerText)
    setRecap((current) => [...current.filter((item) => item.questionId !== question.id), next])
    setRevealed(true)
  }

  function goNext() {
    if (index >= drill.questions.length - 1) {
      finishSession()
      return
    }
    setIndex((value) => value + 1)
    setRevealed(false)
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button type="button" className="text-sm font-medium text-blue-700" onClick={onExit}>
          ← All drills
        </button>
        <PageHeader
          title={`${drill.type} practice`}
          subtitle={`${drill.durationMin}-minute timed session · ${drill.questions.length} prompts. This is a guided warm-up, not a live model.`}
        />
        <Card className="mt-8 p-6">
          <p className="text-sm leading-6 text-slate-600">{drill.summary}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {drill.questions.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setStarted(true)
                setRemaining(drill.durationMin * 60)
              }}
            >
              Start {drill.durationMin}-minute session
            </Button>
            <Button variant="outline" onClick={onExit}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (done) {
    const answered = recap.filter((item) => item.text.trim())
    const coveredCount = recap.reduce((sum, item) => sum + item.covered.length, 0)
    const missedCount = recap.reduce((sum, item) => sum + item.missed.length, 0)

    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Session recap"
          subtitle={`${drill.type} · ${answered.length} of ${drill.questions.length} prompts answered`}
        />
        <Card className="mt-8 p-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Time left</dt>
              <dd className="font-semibold text-navy-950">{formatClock(remaining)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Points you hit</dt>
              <dd className="font-semibold text-emerald-700">{coveredCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Still to cover</dt>
              <dd className="font-semibold text-navy-950">{missedCount}</dd>
            </div>
          </dl>
          <div className="mt-6 space-y-4">
            {drill.questions.map((item) => {
              const result = recap.find((entry) => entry.questionId === item.id)
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <h2 className="font-semibold text-navy-950">{item.title}</h2>
                  {result && isAttemptedAnswer(item, result.text) ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{result.text}</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Skipped</p>
                  )}
                  {result?.covered.length ? (
                    <p className="mt-3 text-sm text-emerald-700">Covered: {result.covered.join(' · ')}</p>
                  ) : null}
                  {result?.missed.length ? (
                    <p className="mt-1 text-sm text-slate-600">Coach still wants: {result.missed.join(' · ')}</p>
                  ) : null}
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    <span className="font-medium text-navy-950">Strong answer: </span>
                    {item.modelOutline}
                  </p>
                </div>
              )
            })}
          </div>
          {notes.trim() ? (
            <div className="mt-6 rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-navy-950">Your notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{notes}</p>
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => {
                setStarted(false)
                setDone(false)
                setIndex(0)
                setRevealed(false)
                setRecap([])
                setAnswers(emptyAnswers(drill))
                setChecked([])
                setNotes('')
                setRemaining(drill.durationMin * 60)
                finishingRef.current = false
              }}
            >
              Practice again
            </Button>
            <Link to={`/candidate/find?type=${encodeURIComponent(drill.type)}`}>
              <Button variant="outline">Book a human {drill.type} mock</Button>
            </Link>
            <Button variant="ghost" onClick={onExit}>
              All drills
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-sm font-medium text-blue-700" onClick={onExit}>
          ← Exit drill
        </button>
        <div className="flex items-center gap-3">
          <Badge tone={remaining <= 60 ? 'violet' : 'navy'}>{formatClock(remaining)} left</Badge>
          <span className="text-sm text-slate-600">
            Question {index + 1} of {drill.questions.length}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{drill.type}</p>
          <h1 className="mt-1 text-xl font-semibold text-navy-950">{question.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">{question.prompt}</p>

          <div className="mt-5">
            <FieldLabel htmlFor="practice-answer">{question.kind === 'coding' ? 'Your code / approach' : 'Your answer'}</FieldLabel>
            <TextArea
              id="practice-answer"
              value={answerText}
              onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
              className={question.kind === 'coding' ? 'min-h-48 font-mono text-[13px]' : 'min-h-40'}
              placeholder={question.kind === 'coding' ? 'Write your approach or code here…' : 'Write your answer here…'}
              spellCheck={question.kind !== 'coding'}
            />
          </div>

          {revealed && coverage ? (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <h2 className="font-semibold text-navy-950">Coach debrief</h2>
              {coverage.covered.length ? (
                <p className="mt-2 text-emerald-700">You hit: {coverage.covered.join(' · ')}</p>
              ) : (
                <p className="mt-2 text-slate-600">No rubric points detected yet — compare with the outline below.</p>
              )}
              {coverage.missed.length ? (
                <p className="mt-1 text-slate-700">Mention next time: {coverage.missed.join(' · ')}</p>
              ) : (
                <p className="mt-1 text-emerald-700">You covered the main rubric points.</p>
              )}
              <p className="mt-3 leading-6 text-slate-700">
                <span className="font-medium text-navy-950">Strong answer: </span>
                {question.modelOutline}
              </p>
              <p className="mt-3 leading-6 text-slate-700">
                <span className="font-medium text-navy-950">Follow-up: </span>
                {question.followUp}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {!revealed ? (
              <Button onClick={submitCurrent} disabled={!question || !isAttemptedAnswer(question, answerText)}>
                Submit answer
              </Button>
            ) : (
              <Button onClick={goNext}>{index >= drill.questions.length - 1 ? 'Finish session' : 'Next question'}</Button>
            )}
            <Button variant="outline" onClick={() => finishSession()}>
              End session
            </Button>
          </div>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="font-semibold text-navy-950">Notes</h2>
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 min-h-32"
            placeholder="Private scratch pad for this session."
          />
          <h3 className="mt-4 text-sm font-semibold text-navy-950">Checklist</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {drill.checklist.map((item) => {
              const on = checked.includes(item)
              return (
                <li key={item}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setChecked((current) => (on ? current.filter((entry) => entry !== item) : [...current, item]))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-navy-950 focus:ring-blue-600"
                    />
                    {item}
                  </label>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}
