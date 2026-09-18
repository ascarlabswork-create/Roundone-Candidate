import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import {
  Badge,
  Card,
  Chip,
  FieldLabel,
  PageHeader,
  SelectInput,
  TextArea,
  TextInput,
} from '../components/ui/primitives.tsx'
import { INTERVIEW_TYPES, SKILLS, TARGET_ROLES } from '../data/catalogs.ts'
import { requestPracticeFeedback, requestPracticeQuestions } from '../practice/aiAssist.ts'
import {
  PRACTICE_ANSWER_MAX,
  PRACTICE_DIFFICULTIES,
  PRACTICE_QUESTION_COUNTS,
  averagePracticeScore,
  difficultyFromCandidateLevel,
  isPracticeDifficulty,
  uniqueThemes,
  type PracticeDifficulty,
  type PracticeQuestionCount,
  type PracticeSetup,
} from '../practice/aiModel.ts'
import {
  clearPracticeSession,
  emptyPracticeSession,
  readPracticeSession,
  writePracticeSession,
  type SavedPracticeSession,
} from '../practice/session.ts'
import { getCandidatePreferencesIfPresent, getCandidateSkills } from '../services/candidateProfile.ts'
import { saveCompletedPracticeSession } from '../services/practiceProgress.ts'
import { useSession } from '../state/session.tsx'

const UNAVAILABLE = 'AI practice is temporarily unavailable. Please try again.'

let saveInFlight: { fingerprint: string; promise: Promise<string> } | null = null

function practiceSaveFingerprint(session: SavedPracticeSession) {
  return JSON.stringify({
    role: session.setup.targetRole,
    type: session.setup.interviewType,
    questions: session.questions.map((item) => item.question),
    answers: session.turns.map((item) => [item.question.id, item.answer, item.feedback?.score]),
  })
}

function difficultyLabel(value: PracticeDifficulty) {
  if (value === 'beginner') return 'Beginner'
  if (value === 'advanced') return 'Advanced'
  return 'Intermediate'
}

export function AiPracticePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { account } = useSession()
  const [session, setSession] = useState<SavedPracticeSession>(() => readPracticeSession())
  const [skillDraft, setSkillDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [persistError, setPersistError] = useState<string | null>(null)
  const [persisting, setPersisting] = useState(false)
  const [persistNonce, setPersistNonce] = useState(0)
  const [prefilled, setPrefilled] = useState(false)
  const submittingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    writePracticeSession(session)
  }, [session])

  useEffect(() => {
    const again = searchParams.get('again') === '1'
    const fresh = searchParams.get('fresh') === '1'
    if (!again && !fresh) return
    const next = emptyPracticeSession()
    if (again) {
      const difficultyRaw = (searchParams.get('difficulty') ?? '').trim().toLowerCase()
      next.setup = {
        ...next.setup,
        targetRole: (searchParams.get('role') ?? '').trim().slice(0, 80),
        interviewType: (searchParams.get('type') ?? '').trim().slice(0, 60),
        difficulty: isPracticeDifficulty(difficultyRaw) ? difficultyRaw : 'intermediate',
        skills: (searchParams.get('skills') ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 6),
      }
    }
    setSession(next)
    setError(null)
    setPersistError(null)
    setPrefilled(again)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (session.phase !== 'complete' || session.savedSessionId || session.questions.length === 0) return
    const snapshot = sessionRef.current
    const fingerprint = practiceSaveFingerprint(snapshot)
    if (!saveInFlight || saveInFlight.fingerprint !== fingerprint) {
      saveInFlight = { fingerprint, promise: saveCompletedPracticeSession(snapshot) }
    }
    const pending = saveInFlight.promise
    let cancelled = false
    setPersisting(true)
    setPersistError(null)
    void pending
      .then((id) => {
        const stored = readPracticeSession()
        if (stored.phase === 'complete' && !stored.savedSessionId) {
          writePracticeSession({ ...stored, savedSessionId: id })
        }
        if (cancelled) return
        setSession((current) =>
          current.phase === 'complete' && !current.savedSessionId ? { ...current, savedSessionId: id } : current,
        )
      })
      .catch((caught: unknown) => {
        if (saveInFlight?.fingerprint === fingerprint) saveInFlight = null
        if (cancelled) return
        setPersistError(caught instanceof Error ? caught.message : 'Unable to save this practice session. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setPersisting(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.phase, session.savedSessionId, session.questions.length, persistNonce])

  useEffect(() => {
    if (prefilled || session.phase !== 'setup' || !account) return
    let cancelled = false
    void Promise.all([getCandidatePreferencesIfPresent(), getCandidateSkills()])
      .then(([preferences, skills]) => {
        if (cancelled) return
        setSession((current) => {
          if (current.phase !== 'setup' || current.questions.length > 0) return current
          const nextSkills = (skills.length > 0 ? skills : preferences?.skills ?? []).slice(0, 6)
          return {
            ...current,
            setup: {
              ...current.setup,
              targetRole: current.setup.targetRole || account.candidate.target_role || '',
              interviewType: current.setup.interviewType || preferences?.interview_type || '',
              skills: current.setup.skills.length > 0 ? current.setup.skills : nextSkills,
              difficulty:
                current.setup.difficulty !== 'intermediate' || !account.candidate.candidate_level
                  ? current.setup.difficulty
                  : difficultyFromCandidateLevel(account.candidate.candidate_level),
            },
          }
        })
        setPrefilled(true)
      })
      .catch(() => {
        if (!cancelled) setPrefilled(true)
      })
    return () => {
      cancelled = true
    }
  }, [account, prefilled, session.phase, session.questions.length])

  function updateSetup(patch: Partial<PracticeSetup>) {
    setSession((current) => ({ ...current, setup: { ...current.setup, ...patch } }))
  }

  function addSkill(value: string) {
    const skill = value.trim()
    if (!skill || session.setup.skills.includes(skill) || session.setup.skills.length >= 6) return
    updateSetup({ skills: [...session.setup.skills, skill] })
    setSkillDraft('')
  }

  async function startPractice(event: FormEvent) {
    event.preventDefault()
    if (busy || submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    setError(null)
    const questions = await requestPracticeQuestions(session.setup)
    submittingRef.current = false
    setBusy(false)
    if (!questions) {
      setError(UNAVAILABLE)
      return
    }
    setSession({
      version: 1,
      phase: 'question',
      setup: session.setup,
      questions,
      index: 0,
      turns: [],
      currentAnswer: '',
      savedSessionId: null,
    })
  }

  async function submitAnswer() {
    const question = session.questions[session.index]
    if (!question || busy || submittingRef.current) return
    const answer = session.currentAnswer.trim()
    if (answer.length < 8) return
    submittingRef.current = true
    setBusy(true)
    setError(null)
    const feedback = await requestPracticeFeedback(question, answer)
    submittingRef.current = false
    setBusy(false)
    if (!feedback) {
      setError(UNAVAILABLE)
      return
    }
    const turn = { question, answer, feedback }
    const turns = [...session.turns.filter((item) => item.question.id !== question.id), turn]
    setSession({ ...session, phase: 'feedback', turns, currentAnswer: answer })
  }

  function goNext() {
    const nextIndex = session.index + 1
    if (nextIndex >= session.questions.length) {
      setSession({ ...session, phase: 'complete', currentAnswer: '' })
      return
    }
    const existing = session.turns.find((item) => item.question.id === session.questions[nextIndex]?.id)
    setSession({
      ...session,
      phase: existing?.feedback ? 'feedback' : 'question',
      index: nextIndex,
      currentAnswer: existing?.answer ?? '',
    })
  }

  function restartSetup() {
    saveInFlight = null
    clearPracticeSession()
    setSession(emptyPracticeSession())
    setError(null)
    setPersistError(null)
    setPrefilled(false)
  }

  const question = session.questions[session.index]
  const currentTurn = question ? session.turns.find((item) => item.question.id === question.id) : null
  const canStart =
    Boolean(session.setup.targetRole.trim() && session.setup.interviewType.trim()) && session.setup.skills.length > 0

  if (session.phase === 'complete') {
    const scored = session.turns.filter((turn) => turn.feedback)
    const average = averagePracticeScore(session.turns)
    const strengths = uniqueThemes(session.turns, 'strengths')
    const improvements = uniqueThemes(session.turns, 'improvements')
    const review = uniqueThemes(session.turns, 'missingPoints')
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Practice complete"
          subtitle="This is practice feedback from your answers in this session. It is not official interviewer feedback or a hiring result."
        />
        <Card className="mt-8 p-5 sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Questions</dt>
              <dd className="mt-1 text-2xl font-semibold text-navy-950">
                {scored.length} of {session.questions.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Average practice score</dt>
              <dd className="mt-1 text-2xl font-semibold text-navy-950">
                {average == null ? '—' : `${average}/10`}
              </dd>
            </div>
          </dl>
          <SummaryList title="Strengths" items={strengths} />
          <SummaryList title="Areas to improve" items={improvements} />
          <SummaryList title="Topics to review" items={review} />
          {persisting ? <p className="mt-4 text-sm text-slate-600">Saving this practice session…</p> : null}
          {persistError ? (
            <div className="mt-4">
              <p className="text-sm text-red-700">{persistError}</p>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-blue-700"
                onClick={() => setPersistNonce((value) => value + 1)}
              >
                Try saving again
              </button>
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {session.savedSessionId ? (
              <Link to={`/candidate/practice/history/${session.savedSessionId}`}>
                <Button variant="outline">View saved results</Button>
              </Link>
            ) : null}
            <Link to="/candidate/practice/history">
              <Button variant="outline">Practice progress</Button>
            </Link>
            <Button onClick={restartSetup}>New practice</Button>
            <Button variant="outline" onClick={() => navigate('/candidate/find')}>
              Book a human interviewer
            </Button>
            <Button variant="ghost" onClick={() => navigate('/candidate/practice')}>
              Back to practice
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if ((session.phase === 'question' || session.phase === 'feedback') && question) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="text-sm font-medium text-blue-700" onClick={restartSetup}>
            ← Exit practice
          </button>
          <span className="text-sm text-slate-600">
            Question {session.index + 1} of {session.questions.length}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-navy-900 transition-[width]"
            style={{
              width: `${((session.index + (session.phase === 'feedback' ? 1 : 0)) / session.questions.length) * 100}%`,
            }}
          />
        </div>
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">{session.setup.interviewType}</Badge>
            <Badge>{question.topic}</Badge>
            <Badge tone="slate">{difficultyLabel(question.difficulty)}</Badge>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Practice question</p>
          <h1 className="mt-1 text-xl font-semibold text-navy-950">{question.question}</h1>
          <p className="mt-3 text-sm text-slate-600">Expected focus: {question.expectedFocus.join(' · ')}</p>

          <div className="mt-5">
            <FieldLabel htmlFor="mock-answer">Your answer</FieldLabel>
            <TextArea
              id="mock-answer"
              value={session.currentAnswer}
              disabled={busy || session.phase === 'feedback'}
              onChange={(event) => setSession({ ...session, currentAnswer: event.target.value.slice(0, PRACTICE_ANSWER_MAX) })}
              className="min-h-48 sm:min-h-56"
              placeholder="Write your answer in text. This stays in this practice session."
            />
            <p className="mt-1 text-xs text-slate-500">
              {session.currentAnswer.trim().length}/{PRACTICE_ANSWER_MAX}
            </p>
          </div>

          {session.phase === 'feedback' && currentTurn?.feedback ? (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Practice feedback</p>
              <p className="mt-1 text-lg font-semibold text-navy-950">Practice score: {currentTurn.feedback.score}/10</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{currentTurn.feedback.summary}</p>
              <SummaryList title="Strengths" items={currentTurn.feedback.strengths} compact />
              <SummaryList title="Areas to improve" items={currentTurn.feedback.improvements} compact />
              <SummaryList title="Topics to revisit" items={currentTurn.feedback.missingPoints} compact />
              <p className="mt-3 text-xs text-slate-500">
                This is an AI practice score against the expected focus, not a hiring or employability score.
              </p>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {session.phase === 'question' ? (
              <Button onClick={() => void submitAnswer()} disabled={busy || session.currentAnswer.trim().length < 8}>
                {busy ? 'Scoring…' : 'Submit answer'}
              </Button>
            ) : (
              <Button onClick={goNext}>
                {session.index >= session.questions.length - 1 ? 'See summary' : 'Next question'}
              </Button>
            )}
            <Button variant="outline" onClick={restartSetup} disabled={busy}>
              Return to setup
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button type="button" className="text-sm font-medium text-blue-700" onClick={() => navigate('/candidate/practice')}>
        ← All practice
      </button>
      <PageHeader
        title="Practice interview"
        subtitle="Generate practice questions and get practice feedback. This is not a booked interview and does not change official interviewer records."
      />
      <form className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8" onSubmit={(event) => void startPractice(event)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="practice-role">Role</FieldLabel>
            <TextInput
              id="practice-role"
              required
              list="practice-role-options"
              value={session.setup.targetRole}
              onChange={(event) => updateSetup({ targetRole: event.target.value })}
              placeholder="Select or type a role"
            />
            <datalist id="practice-role-options">
              {TARGET_ROLES.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          </div>
          <div>
            <FieldLabel htmlFor="practice-type">Interview type</FieldLabel>
            <SelectInput
              id="practice-type"
              required
              value={session.setup.interviewType}
              onChange={(event) => updateSetup({ interviewType: event.target.value })}
            >
              <option value="">Select a type</option>
              {INTERVIEW_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="practice-difficulty">Difficulty</FieldLabel>
            <SelectInput
              id="practice-difficulty"
              value={session.setup.difficulty}
              onChange={(event) => updateSetup({ difficulty: event.target.value as PracticeDifficulty })}
            >
              {PRACTICE_DIFFICULTIES.map((item) => (
                <option key={item} value={item}>
                  {difficultyLabel(item)}
                </option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="practice-count">Questions</FieldLabel>
            <SelectInput
              id="practice-count"
              value={String(session.setup.questionCount)}
              onChange={(event) =>
                updateSetup({ questionCount: Number(event.target.value) as PracticeQuestionCount })
              }
            >
              {PRACTICE_QUESTION_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="practice-skills">Topics</FieldLabel>
          <div className="flex gap-2">
            <TextInput
              id="practice-skills"
              list="practice-skill-options"
              placeholder="Python, React, System Design"
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSkill(skillDraft)
                }
              }}
            />
            <Button variant="outline" onClick={() => addSkill(skillDraft)}>
              Add
            </Button>
          </div>
          <datalist id="practice-skill-options">
            {SKILLS.map((skill) => (
              <option key={skill} value={skill} />
            ))}
          </datalist>
          <div className="mt-3 flex flex-wrap gap-2">
            {session.setup.skills.length === 0 ? (
              <p className="text-sm text-slate-500">Add at least one topic.</p>
            ) : (
              session.setup.skills.map((skill) => (
                <Chip
                  key={skill}
                  active
                  onClick={() => updateSetup({ skills: session.setup.skills.filter((item) => item !== skill) })}
                >
                  {skill} ×
                </Chip>
              ))
            )}
          </div>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Link to="/candidate/practice">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={!canStart || busy}>
            {busy ? 'Preparing questions…' : 'Start practice'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function SummaryList({
  title,
  items,
  compact,
}: {
  title: string
  items: string[]
  compact?: boolean
}) {
  if (items.length === 0) return compact ? null : <p className="mt-5 text-sm text-slate-600">{title}: none from this session.</p>
  return (
    <div className={compact ? 'mt-3' : 'mt-5'}>
      <h2 className="text-sm font-semibold text-navy-950">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
