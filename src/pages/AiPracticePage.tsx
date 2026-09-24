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
import { requestNextPracticeQuestion, requestPracticeFeedback } from '../practice/aiAssist.ts'
import {
  PRACTICE_ANSWER_MAX,
  PRACTICE_DIFFICULTIES,
  PRACTICE_QUESTION_COUNTS,
  averagePracticeScore,
  difficultyFromCandidateLevel,
  estimatedInterviewMinutes,
  formatPracticeDuration,
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
import { failPracticeSession, savePracticeTurn, startPracticeSession } from '../services/practiceProgress.ts'
import { useSession } from '../state/session.tsx'

const UNAVAILABLE = 'AI interview is temporarily unavailable. Please try again.'

function difficultyLabel(value: PracticeDifficulty) {
  if (value === 'beginner') return 'Beginner'
  if (value === 'advanced') return 'Advanced'
  return 'Intermediate'
}

function priorTurnsForAi(session: SavedPracticeSession) {
  return session.turns
    .filter((turn) => turn.feedback)
    .map((turn) => ({
      question: turn.question.question,
      topic: turn.question.topic,
      score: turn.feedback?.score ?? null,
      missingPoints: turn.feedback?.missingPoints ?? [],
    }))
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

  function goToIntro(event: FormEvent) {
    event.preventDefault()
    if (!canStart) return
    setError(null)
    setSession({
      ...session,
      phase: 'intro',
      questions: [],
      index: 0,
      turns: [],
      currentAnswer: '',
      savedSessionId: null,
      startedAt: null,
    })
  }

  async function startInterview() {
    if (busy || submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    setError(null)
    setPersistError(null)

    let sessionId: string | null = null
    try {
      sessionId = await startPracticeSession(session.setup)
      const first = await requestNextPracticeQuestion(session.setup, 1, [])
      if (!first) {
        if (sessionId) await failPracticeSession(sessionId)
        setError(UNAVAILABLE)
        return
      }
      const startedAt = new Date().toISOString()
      setSession({
        version: 1,
        phase: 'question',
        setup: session.setup,
        questions: [first],
        index: 0,
        turns: [],
        currentAnswer: '',
        savedSessionId: sessionId,
        startedAt,
      })
    } catch (caught: unknown) {
      if (sessionId) await failPracticeSession(sessionId)
      setError(caught instanceof Error ? caught.message : UNAVAILABLE)
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  async function submitAnswer() {
    const question = session.questions[session.index]
    if (!question || busy || submittingRef.current) return
    const answer = session.currentAnswer.trim()
    if (answer.length < 8) return
    submittingRef.current = true
    setBusy(true)
    setError(null)
    setPersistError(null)
    const feedback = await requestPracticeFeedback(question, answer)
    if (!feedback) {
      submittingRef.current = false
      setBusy(false)
      setError(UNAVAILABLE)
      return
    }
    const turn = { question, answer, feedback }
    const turns = [...session.turns.filter((item) => item.question.id !== question.id), turn]
    if (session.savedSessionId) {
      try {
        await savePracticeTurn(session.savedSessionId, session.index, turn)
      } catch (caught: unknown) {
        submittingRef.current = false
        setBusy(false)
        setPersistError(caught instanceof Error ? caught.message : 'Unable to save this practice answer. Please try again.')
        setSession({ ...session, phase: 'feedback', turns, currentAnswer: answer })
        return
      }
    }
    submittingRef.current = false
    setBusy(false)
    setSession({ ...session, phase: 'feedback', turns, currentAnswer: answer })
  }

  async function goNext() {
    if (busy || submittingRef.current) return
    const nextIndex = session.index + 1
    if (nextIndex >= session.setup.questionCount) {
      setSession({ ...session, phase: 'complete', currentAnswer: '' })
      return
    }

    const existingQuestion = session.questions[nextIndex]
    const existingTurn = existingQuestion
      ? session.turns.find((item) => item.question.id === existingQuestion.id)
      : null
    if (existingQuestion && existingTurn?.feedback) {
      setSession({
        ...session,
        phase: 'feedback',
        index: nextIndex,
        currentAnswer: existingTurn.answer,
      })
      return
    }
    if (existingQuestion) {
      setSession({
        ...session,
        phase: 'question',
        index: nextIndex,
        currentAnswer: existingTurn?.answer ?? '',
      })
      return
    }

    submittingRef.current = true
    setBusy(true)
    setError(null)
    const nextQuestion = await requestNextPracticeQuestion(
      session.setup,
      nextIndex + 1,
      priorTurnsForAi(session),
    )
    submittingRef.current = false
    setBusy(false)
    if (!nextQuestion) {
      setError(UNAVAILABLE)
      return
    }
    setSession({
      ...session,
      phase: 'question',
      index: nextIndex,
      questions: [...session.questions, nextQuestion],
      currentAnswer: '',
    })
  }

  function restartSetup() {
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
  const totalQuestions = session.setup.questionCount
  const progressDenom = Math.max(totalQuestions, 1)

  if (session.phase === 'complete') {
    const scored = session.turns.filter((turn) => turn.feedback)
    const average = averagePracticeScore(session.turns)
    const strengths = uniqueThemes(session.turns, 'strengths')
    const improvements = uniqueThemes(session.turns, 'improvements')
    const review = uniqueThemes(session.turns, 'missingPoints')
    const duration = formatPracticeDuration(session.startedAt)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          title="AI Practice Score"
          subtitle="Deterministic summary from your answers in this session. This is not official interviewer feedback or a hiring result."
        />
        <Card className="mt-8 p-5 sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Questions</dt>
              <dd className="mt-1 text-2xl font-semibold text-navy-950">
                {scored.length} of {totalQuestions}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Average score</dt>
              <dd className="mt-1 text-2xl font-semibold text-navy-950">
                {average == null ? '—' : `${average}/10`}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</dt>
              <dd className="mt-1 text-2xl font-semibold text-navy-950">{duration ?? '—'}</dd>
            </div>
          </dl>
          <SummaryList title="Strengths" items={strengths} />
          <SummaryList title="Areas to improve" items={improvements} />
          <SummaryList title="Topics to review" items={review} />
          {persistError ? <p className="mt-4 text-sm text-red-700">{persistError}</p> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button onClick={restartSetup}>Practice Again</Button>
            <Link to="/candidate/practice/history">
              <Button variant="outline">View Progress</Button>
            </Link>
            {session.savedSessionId ? (
              <Link to={`/candidate/practice/history/${session.savedSessionId}`}>
                <Button variant="outline">View saved results</Button>
              </Link>
            ) : null}
            <Button variant="ghost" onClick={() => navigate('/')}>
              Dashboard
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (session.phase === 'intro') {
    const minutes = estimatedInterviewMinutes(session.setup.questionCount)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button type="button" className="text-sm font-medium text-blue-700" onClick={() => setSession({ ...session, phase: 'setup' })}>
          ← Back to setup
        </button>
        <PageHeader
          title="AI Interview"
          subtitle="Answer naturally as you would in a real interview."
        />
        <Card className="mt-8 space-y-4 p-5 sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</dt>
              <dd className="mt-1 text-sm font-medium text-navy-950">{session.setup.targetRole}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Interview type</dt>
              <dd className="mt-1 text-sm font-medium text-navy-950">{session.setup.interviewType}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Difficulty</dt>
              <dd className="mt-1 text-sm font-medium text-navy-950">{difficultyLabel(session.setup.difficulty)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Questions</dt>
              <dd className="mt-1 text-sm font-medium text-navy-950">
                {session.setup.questionCount} · about {minutes} min
              </dd>
            </div>
          </dl>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Topics</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {session.setup.skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            You will get one question at a time. After each answer, you will see AI practice feedback, then the next question adapts from your prior responses.
          </p>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSession({ ...session, phase: 'setup' })} disabled={busy}>
              Edit setup
            </Button>
            <Button onClick={() => void startInterview()} disabled={busy}>
              {busy ? 'Starting interview…' : 'Start Interview'}
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
            ← Exit interview
          </button>
          <span className="text-sm text-slate-600">
            Question {session.index + 1} of {totalQuestions}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-navy-900 transition-[width]"
            style={{
              width: `${((session.index + (session.phase === 'feedback' ? 1 : 0)) / progressDenom) * 100}%`,
            }}
          />
        </div>
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">AI Interviewer</Badge>
            <Badge>{question.topic}</Badge>
            <Badge tone="slate">{difficultyLabel(question.difficulty)}</Badge>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Interview question</p>
          <h1 className="mt-1 text-xl font-semibold text-navy-950">{question.question}</h1>
          {session.phase === 'feedback' ? (
            <p className="mt-3 text-sm text-slate-600">Expected focus: {question.expectedFocus.join(' · ')}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Answer naturally as you would in a real interview.</p>
          )}

          <div className="mt-5">
            <FieldLabel htmlFor="mock-answer">Your answer</FieldLabel>
            <TextArea
              id="mock-answer"
              value={session.currentAnswer}
              disabled={busy || session.phase === 'feedback'}
              onChange={(event) => setSession({ ...session, currentAnswer: event.target.value.slice(0, PRACTICE_ANSWER_MAX) })}
              className="min-h-48 sm:min-h-56"
              placeholder="Write your answer in text."
            />
            <p className="mt-1 text-xs text-slate-500">
              {session.currentAnswer.trim().length}/{PRACTICE_ANSWER_MAX}
            </p>
          </div>

          {session.phase === 'feedback' && currentTurn?.feedback ? (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI Practice Feedback</p>
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
          {persistError ? <p className="mt-4 text-sm text-red-700">{persistError}</p> : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {session.phase === 'question' ? (
              <Button onClick={() => void submitAnswer()} disabled={busy || session.currentAnswer.trim().length < 8}>
                {busy ? 'Evaluating…' : 'Submit Answer'}
              </Button>
            ) : (
              <Button onClick={() => void goNext()} disabled={busy}>
                {busy
                  ? 'Preparing next question…'
                  : session.index >= totalQuestions - 1
                    ? 'Finish'
                    : 'Next Question'}
              </Button>
            )}
            <Button variant="outline" onClick={restartSetup} disabled={busy}>
              Exit interview
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
        title="AI Interview setup"
        subtitle="Choose your role, type, topics, and difficulty. You will see an introduction before the interview starts."
      />
      <form className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8" onSubmit={goToIntro}>
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
                  {count} · ~{estimatedInterviewMinutes(count)} min
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
          <Button type="submit" disabled={!canStart}>
            Start AI Interview
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
