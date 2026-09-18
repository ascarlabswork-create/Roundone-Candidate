import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import { removeSession, readSessionJson, writeSessionJson } from '../lib/storage.ts'

type SessionAnswer = {
  questionId: string
  text: string
  covered: string[]
  missed: string[]
}

type SavedPractice = {
  version: 1
  type: string
  started: boolean
  done: boolean
  index: number
  revealed: boolean
  notes: string
  checked: string[]
  answers: Record<string, string>
  recap: SessionAnswer[]
  endsAt: number | null
}

function storageKey(type: string) {
  return `roundone.practice.${type}`
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

function secondsLeft(endsAt: number | null) {
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

function scoredAnswer(item: PracticeQuestion, text: string): SessionAnswer {
  const points = coverageForAnswer(text, item.expectedPoints)
  return { questionId: item.id, text, covered: points.covered, missed: points.missed }
}

export function PracticePage() {
  const { type: typeSlug } = useParams()
  const selectedType = practiceTypeFromSlug(typeSlug)

  if (typeSlug === 'mock') {
    return <Navigate to="/candidate/practice/mock" replace />
  }
  if (typeSlug === 'history') {
    return <Navigate to="/candidate/practice/history" replace />
  }

  if (typeSlug && !selectedType) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader title="Practice session not found" subtitle="Pick a drill from AI Practice to start a timed session." />
        <div className="mt-8">
          <Link to="/candidate/practice" className="text-sm font-medium text-blue-700">
            ← Back to AI Practice
          </Link>
        </div>
      </div>
    )
  }

  if (!selectedType) return <PracticeHub />

  return <PracticeSession key={selectedType} drill={PRACTICE_DRILLS[selectedType]} />
}

function PracticeHub() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        title="AI Practice"
        subtitle="Practice with generated questions and written feedback, or use a timed drill. Live mocks still happen with a human interviewer."
      />
      <Card className="mt-8 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Practice interview</p>
            <h2 className="mt-1 font-semibold text-navy-950">Answer questions and get practice feedback</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Choose a role, interview type, and topics. This is AI practice only — it does not create a booking or
              official interviewer feedback.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button onClick={() => navigate('/candidate/practice/mock')}>Practice Interview</Button>
            <Button variant="outline" onClick={() => navigate('/candidate/practice/history')}>
              View Progress
            </Button>
          </div>
        </div>
      </Card>
      <h2 className="mt-10 text-lg font-semibold text-navy-950">Timed drills</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {INTERVIEW_TYPES.map((type) => {
          const drill = PRACTICE_DRILLS[type]
          const saved = readSessionJson<SavedPractice | null>(storageKey(type), null)
          const inProgress = Boolean(saved?.started && !saved.done)
          return (
            <Card key={type} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-navy-950">{type} drill</h2>
                <Badge tone={inProgress ? 'violet' : 'blue'}>{inProgress ? 'In progress' : `${drill.durationMin} min`}</Badge>
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-600">{drill.summary}</p>
              <p className="mt-3 text-xs text-slate-500">{drill.questions.length} prompts · notes + recap</p>
              <div className="mt-4">
                <Button
                  fullWidth
                  onClick={() => navigate(`/candidate/practice/${practiceTypeSlug(type)}?start=1`)}
                >
                  {inProgress ? 'Resume session' : 'Start session'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="mt-8">
        <Button variant="outline" onClick={() => navigate('/candidate/find')}>
          Find a human interviewer instead
        </Button>
      </div>
    </div>
  )
}

function PracticeSession({ drill }: { drill: PracticeDrill }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const autoStart = params.get('start') === '1'
  const saved = readSessionJson<SavedPractice | null>(storageKey(drill.type), null)
  const initial = saved?.version === 1 && saved.type === drill.type ? saved : null
  const canResume = Boolean(initial?.started && !initial.done)
  const startFresh = autoStart && !canResume

  const [started, setStarted] = useState(() => canResume || startFresh || Boolean(initial?.started && initial.done && !autoStart))
  const [done, setDone] = useState(() => (startFresh ? false : Boolean(initial?.done)))
  const [index, setIndex] = useState(() => (canResume ? (initial?.index ?? 0) : 0))
  const [revealed, setRevealed] = useState(() => (canResume ? Boolean(initial?.revealed) : false))
  const [notes, setNotes] = useState(() => (canResume ? (initial?.notes ?? '') : ''))
  const [checked, setChecked] = useState<string[]>(() => (canResume ? (initial?.checked ?? []) : []))
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => (canResume && initial?.answers ? initial.answers : emptyAnswers(drill)),
  )
  const [recap, setRecap] = useState<SessionAnswer[]>(() => (canResume ? (initial?.recap ?? []) : startFresh ? [] : (initial?.recap ?? [])))
  const [endsAt, setEndsAt] = useState<number | null>(() => {
    if (canResume && initial?.endsAt) return initial.endsAt
    if (startFresh) return Date.now() + drill.durationMin * 60_000
    if (initial?.done) return initial.endsAt
    return null
  })
  const [remaining, setRemaining] = useState(() =>
    initial?.done ? secondsLeft(initial.endsAt) : secondsLeft(endsAt) || drill.durationMin * 60,
  )

  const finishingRef = useRef(false)
  const recapRef = useRef(recap)
  const answersRef = useRef(answers)
  recapRef.current = recap
  answersRef.current = answers

  const question = drill.questions[index] ?? drill.questions[0]
  const answerText = question ? (answers[question.id] ?? '') : ''
  const coverage = useMemo(
    () => (revealed && question ? coverageForAnswer(answerText, question.expectedPoints) : null),
    [answerText, question, revealed],
  )

  function persist(next: Partial<SavedPractice> & Pick<SavedPractice, 'started' | 'done'>) {
    const payload: SavedPractice = {
      version: 1,
      type: drill.type,
      index,
      revealed,
      notes,
      checked,
      answers,
      recap,
      endsAt,
      ...next,
    }
    writeSessionJson(storageKey(drill.type), payload)
  }

  function finishSession() {
    if (finishingRef.current) return
    finishingRef.current = true
    const currentRecap = recapRef.current
    const currentAnswers = answersRef.current
    const completedIds = new Set(currentRecap.map((item) => item.questionId))
    const pending = drill.questions
      .filter((item) => !completedIds.has(item.id) && isAttemptedAnswer(item, currentAnswers[item.id] ?? ''))
      .map((item) => scoredAnswer(item, currentAnswers[item.id] ?? ''))
    const nextRecap = [...currentRecap, ...pending]
    setRecap(nextRecap)
    setDone(true)
    persist({ started: true, done: true, recap: nextRecap, answers: currentAnswers })
  }

  function beginSession() {
    const nextEnds = Date.now() + drill.durationMin * 60_000
    finishingRef.current = false
    setStarted(true)
    setDone(false)
    setIndex(0)
    setRevealed(false)
    setRecap([])
    setAnswers(emptyAnswers(drill))
    setChecked([])
    setNotes('')
    setEndsAt(nextEnds)
    setRemaining(drill.durationMin * 60)
    persist({
      started: true,
      done: false,
      index: 0,
      revealed: false,
      notes: '',
      checked: [],
      answers: emptyAnswers(drill),
      recap: [],
      endsAt: nextEnds,
    })
  }

  useEffect(() => {
    if (!started || done || !endsAt) return
    const tick = () => {
      const left = secondsLeft(endsAt)
      setRemaining(left)
      if (left <= 0) finishSession()
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, endsAt])

  useEffect(() => {
    if (!started) return
    persist({ started, done, index, revealed, notes, checked, answers, recap, endsAt })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, index, revealed, notes, checked, answers, recap, endsAt])

  function submitCurrent() {
    if (!question || !isAttemptedAnswer(question, answerText)) return
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

  function skipCurrent() {
    if (!question) return
    setRecap((current) => current.filter((item) => item.questionId !== question.id))
    if (index >= drill.questions.length - 1) {
      finishSession()
      return
    }
    setIndex((value) => value + 1)
    setRevealed(false)
  }

  function resetAndExit() {
    removeSession(storageKey(drill.type))
    navigate('/candidate/practice')
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button type="button" className="text-sm font-medium text-blue-700" onClick={() => navigate('/candidate/practice')}>
          ← All drills
        </button>
        <PageHeader
          title={`${drill.type} practice`}
          subtitle={`${drill.durationMin}-minute timed session · ${drill.questions.length} prompts.`}
        />
        <Card className="mt-8 p-6">
          <p className="text-sm leading-6 text-slate-600">{drill.summary}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {drill.questions.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={beginSession}>Start {drill.durationMin}-minute session</Button>
            <Button variant="outline" onClick={() => navigate('/candidate/practice')}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (done) {
    const answered = recap.filter((item) => {
      const q = drill.questions.find((question) => question.id === item.questionId)
      return q ? isAttemptedAnswer(q, item.text) : Boolean(item.text.trim())
    })
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
              const attempted = result ? isAttemptedAnswer(item, result.text) : false
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <h2 className="font-semibold text-navy-950">{item.title}</h2>
                  {attempted ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{result?.text}</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Skipped</p>
                  )}
                  {attempted && result?.covered.length ? (
                    <p className="mt-3 text-sm text-emerald-700">Covered: {result.covered.join(' · ')}</p>
                  ) : null}
                  {attempted && result?.missed.length ? (
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
                finishingRef.current = false
                removeSession(storageKey(drill.type))
                beginSession()
              }}
            >
              Practice again
            </Button>
            <Button variant="outline" onClick={() => navigate(`/candidate/find?type=${encodeURIComponent(drill.type)}`)}>
              Book a human {drill.type} mock
            </Button>
            <Button variant="ghost" onClick={resetAndExit}>
              All drills
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!question) return null

  const canSubmit = isAttemptedAnswer(question, answerText)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-sm font-medium text-blue-700" onClick={() => navigate('/candidate/practice')}>
          ← Exit drill
        </button>
        <div className="flex items-center gap-3">
          <Badge tone={remaining <= 60 ? 'violet' : 'navy'}>{formatClock(remaining)} left</Badge>
          <span className="text-sm text-slate-600">
            Question {index + 1} of {drill.questions.length}
          </span>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-navy-900 transition-[width]"
          style={{ width: `${((index + (revealed ? 1 : 0)) / drill.questions.length) * 100}%` }}
        />
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
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  submitCurrent()
                }
              }}
              className={question.kind === 'coding' ? 'min-h-48 font-mono text-[13px]' : 'min-h-40'}
              placeholder={question.kind === 'coding' ? 'Write your approach or code here…' : 'Write your answer here…'}
              spellCheck={question.kind !== 'coding'}
            />
            <p className="mt-1 text-xs text-slate-500">Ctrl+Enter to submit</p>
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
              <Button onClick={submitCurrent} disabled={!canSubmit}>
                Submit answer
              </Button>
            ) : (
              <Button onClick={goNext}>{index >= drill.questions.length - 1 ? 'Finish session' : 'Next question'}</Button>
            )}
            {!revealed ? (
              <Button variant="outline" onClick={skipCurrent}>
                Skip
              </Button>
            ) : null}
            <Button variant="ghost" onClick={finishSession}>
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
