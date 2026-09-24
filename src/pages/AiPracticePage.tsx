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
  INTERVIEWER_PERSONAS,
  averagePracticeScore,
  difficultyFromCandidateLevel,
  estimatedInterviewMinutes,
  formatPracticeDuration,
  getInterviewerPersona,
  getRecentAskedQuestions,
  isPracticeDifficulty,
  pickRandomFocusDimension,
  recordAskedQuestion,
  recordAskedQuestions,
  uniqueThemes,
  type PracticeAiQuestion,
  type PracticeDifficulty,
  type PracticeQuestionCount,
  type PracticeSetup,
  type PracticeTurn,
} from '../practice/aiModel.ts'
import {
  buildStructuredContext,
  type CandidateContext,
} from '../practice/contextEngine.ts'
import {
  clearPracticeSession,
  emptyPracticeSession,
  readPracticeSession,
  writePracticeSession,
  type SavedPracticeSession,
} from '../practice/session.ts'
import { VoiceClient, type VoiceState } from '../practice/voiceClient.ts'
import { getCandidatePreferencesIfPresent, getCandidateSkills } from '../services/candidateProfile.ts'
import {
  failPracticeSession,
  fetchRecentPracticeQuestionTexts,
  savePracticeTurn,
  startPracticeSession,
} from '../services/practiceProgress.ts'
import { useSession } from '../state/session.tsx'

const UNAVAILABLE = 'AI interview is temporarily unavailable. Please try again.'

function difficultyLabel(value: PracticeDifficulty) {
  if (value === 'beginner') return 'Beginner'
  if (value === 'advanced') return 'Advanced'
  return 'Intermediate'
}

function MicIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3v6a3 3 0 003 3z"
      />
    </svg>
  )
}

function MicOffIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M12 15a3 3 0 01-3-3V6a3 3 0 014.243-2.757M12 18.75v3.75m-3.75 0h7.5"
      />
    </svg>
  )
}

function VolumeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"
      />
    </svg>
  )
}

function ReplayIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  )
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
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [micMuted, setMicMuted] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [resumePrompt, setResumePrompt] = useState(false)
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null)

  const submittingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const voiceClientRef = useRef<VoiceClient | null>(null)

  useEffect(() => {
    writePracticeSession(session)
  }, [session])

  useEffect(() => {
    // Check if valid unfinished session exists on mount
    const saved = readPracticeSession()
    if (saved.savedSessionId && saved.phase === 'question' && saved.questions.length > 0) {
      setResumePrompt(true)
    }

    // Prefetch past question history into local avoidance memory
    void fetchRecentPracticeQuestionTexts().then((serverQuestions) => {
      if (serverQuestions.length > 0) {
        recordAskedQuestions(serverQuestions)
      }
    })
  }, [])

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
    setResumePrompt(false)
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

  // Cleanup voice client when unmounting or leaving question phase
  useEffect(() => {
    return () => {
      if (voiceClientRef.current) {
        voiceClientRef.current.close()
        voiceClientRef.current = null
      }
    }
  }, [])

  function getCandidateContext(): CandidateContext {
    return {
      role: account?.candidate.target_role || session.setup.targetRole || 'Software Engineer',
      level: account?.candidate.candidate_level || 'Mid-Level',
      skills: session.setup.skills,
      headline: account?.candidate.headline || undefined,
      bio: account?.candidate.bio || undefined,
    }
  }

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
      const candContext = getCandidateContext()
      const persona = getInterviewerPersona(session.setup.interviewerId)
      const recent = getRecentAskedQuestions()
      const focusDim = pickRandomFocusDimension()
      const seed = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

      const first = await requestNextPracticeQuestion(session.setup, 1, [], {
        candidate: candContext,
        interviewerName: persona.name,
        excludeQuestions: recent,
        focusDimension: focusDim,
        sessionSeed: seed,
      })

      if (!first) {
        if (sessionId) await failPracticeSession(sessionId)
        setError(UNAVAILABLE)
        return
      }

      recordAskedQuestion(first.question)

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

      // Initialize voice connection
      await setupVoiceClient(first)
    } catch (caught: unknown) {
      if (sessionId) await failPracticeSession(sessionId)
      setError(caught instanceof Error ? caught.message : UNAVAILABLE)
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  async function resumeSession() {
    setResumePrompt(false)
    if (session.questions.length > 0) {
      recordAskedQuestions(session.questions.map((q) => q.question))
    }
    const currentQ = session.questions[session.index]
    if (currentQ) {
      await setupVoiceClient(currentQ)
    }
  }

  async function setupVoiceClient(initialQuestion: PracticeAiQuestion) {
    if (voiceClientRef.current) {
      voiceClientRef.current.close()
    }

    const persona = getInterviewerPersona(sessionRef.current.setup.interviewerId)

    const client = new VoiceClient({
      onStateChange: (state) => {
        setVoiceState(state)
      },
      onCandidateTranscript: (transcript) => {
        setSession((current) => ({
          ...current,
          currentAnswer: transcript.slice(0, PRACTICE_ANSWER_MAX),
        }))
      },
      onError: (errMsg) => {
        setError(errMsg)
      },
      onTurnComplete: (transcript) => {
        setAutoSubmitCountdown(null)
        if (transcript.trim().length >= 8 && !submittingRef.current) {
          void handleTurnAnswer(transcript.trim())
        }
      },
      onAutoSubmitCountdown: (secondsRemaining) => {
        setAutoSubmitCountdown(secondsRemaining)
      },
    })

    voiceClientRef.current = client
    const started = await client.start(sessionRef.current.setup, persona.voice, persona.name)
    if (started) {
      await client.speakQuestion(initialQuestion.question, persona.voice)
    }
  }

  async function handleTurnAnswer(answerText: string) {
    const curSession = sessionRef.current
    const question = curSession.questions[curSession.index]
    if (!question || busy || submittingRef.current || answerText.length < 8) return

    setAutoSubmitCountdown(null)
    voiceClientRef.current?.cancelSilenceTimer()
    submittingRef.current = true
    setBusy(true)
    setError(null)
    setPersistError(null)
    setVoiceState('evaluating')

    try {
      const feedback = await requestPracticeFeedback(question, answerText)
      if (!feedback) {
        submittingRef.current = false
        setBusy(false)
        setVoiceState('listening')
        setError('Answer evaluation was interrupted. You can retry submitting.')
        return
      }

      const turn: PracticeTurn = { question, answer: answerText, feedback }
      const turns = [...curSession.turns.filter((item) => item.question.id !== question.id), turn]

      if (curSession.savedSessionId) {
        try {
          await savePracticeTurn(curSession.savedSessionId, curSession.index, turn)
        } catch (caught: unknown) {
          setPersistError(caught instanceof Error ? caught.message : 'Unable to save this answer.')
        }
      }

      const nextIndex = curSession.index + 1
      if (nextIndex >= curSession.setup.questionCount) {
        // Complete interview
        if (voiceClientRef.current) {
          voiceClientRef.current.close()
          voiceClientRef.current = null
        }
        setSession({
          ...curSession,
          phase: 'complete',
          turns,
          currentAnswer: '',
        })
        submittingRef.current = false
        setBusy(false)
        return
      }

      // Generate next adaptive context-aware question
      setVoiceState('thinking')
      const candContext = getCandidateContext()
      const structured = buildStructuredContext(candContext, curSession.setup, turns)
      const persona = getInterviewerPersona(curSession.setup.interviewerId)

      const priorTurnsData = turns.map((t) => ({
        question: t.question.question,
        topic: t.question.topic,
        answer: t.answer,
        score: t.feedback?.score ?? null,
        missingPoints: t.feedback?.missingPoints ?? [],
      }))

      const recent = [
        ...curSession.questions.map((q) => q.question),
        ...getRecentAskedQuestions(),
      ]
      const focusDim = pickRandomFocusDimension(curSession.questions.map((q) => q.topic))
      const seed = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

      const nextQuestion = await requestNextPracticeQuestion(
        curSession.setup,
        nextIndex + 1,
        priorTurnsData,
        {
          candidate: candContext,
          structured,
          interviewerName: persona.name,
          excludeQuestions: recent,
          focusDimension: focusDim,
          sessionSeed: seed,
        },
      )

      if (!nextQuestion) {
        submittingRef.current = false
        setBusy(false)
        setError(UNAVAILABLE)
        return
      }

      recordAskedQuestion(nextQuestion.question)

      const nextQuestions = [...curSession.questions, nextQuestion]
      voiceClientRef.current?.resetTurnTranscript()
      setAutoSubmitCountdown(null)

      setSession({
        ...curSession,
        phase: 'question',
        index: nextIndex,
        questions: nextQuestions,
        turns,
        currentAnswer: '',
      })

      submittingRef.current = false
      setBusy(false)

      // AI speaks next question
      if (voiceClientRef.current) {
        await voiceClientRef.current.speakQuestion(nextQuestion.question, persona.voice)
      }
    } catch (err: unknown) {
      submittingRef.current = false
      setBusy(false)
      setVoiceState('listening')
      setError(err instanceof Error ? err.message : UNAVAILABLE)
    }
  }

  function handleKeepSpeaking() {
    setAutoSubmitCountdown(null)
    voiceClientRef.current?.cancelSilenceTimer()
  }

  function handleMuteToggle() {
    if (voiceClientRef.current) {
      const nextMuted = !micMuted
      voiceClientRef.current.muteMicrophone(nextMuted)
      setMicMuted(nextMuted)
    }
  }

  function handleReplayQuestion() {
    const q = session.questions[session.index]
    if (q && voiceClientRef.current) {
      const persona = getInterviewerPersona(session.setup.interviewerId)
      void voiceClientRef.current.speakQuestion(q.question, persona.voice)
    }
  }

  function confirmEndInterview() {
    if (voiceClientRef.current) {
      voiceClientRef.current.close()
      voiceClientRef.current = null
    }
    setConfirmEndOpen(false)
    if (session.turns.length > 0) {
      setSession({ ...session, phase: 'complete' })
    } else {
      restartSetup()
    }
  }

  function restartSetup() {
    if (voiceClientRef.current) {
      voiceClientRef.current.close()
      voiceClientRef.current = null
    }
    clearPracticeSession()
    setSession(emptyPracticeSession())
    setError(null)
    setPersistError(null)
    setPrefilled(false)
    setResumePrompt(false)
  }

  const question = session.questions[session.index]
  const canStart =
    Boolean(session.setup.targetRole.trim() && session.setup.interviewType.trim()) && session.setup.skills.length > 0
  const totalQuestions = session.setup.questionCount
  const progressDenom = Math.max(totalQuestions, 1)

  // Resumption prompt modal
  if (resumePrompt) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Card className="p-6">
          <Badge tone="blue">Active Session Found</Badge>
          <h2 className="mt-3 text-lg font-semibold text-navy-950">Resume your AI Interview?</h2>
          <p className="mt-2 text-sm text-slate-600">
            You have an interview in progress for <strong>{session.setup.targetRole}</strong> with{' '}
            {session.turns.length} answer{session.turns.length === 1 ? '' : 's'} recorded.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={restartSetup}>
              Start Fresh
            </Button>
            <Button onClick={() => void resumeSession()}>Resume Interview</Button>
          </div>
        </Card>
      </div>
    )
  }

  // Phase: Complete (Final AI Practice Report)
  if (session.phase === 'complete') {
    const scored = session.turns.filter((turn) => turn.feedback)
    const average = averagePracticeScore(session.turns)
    const strengths = uniqueThemes(session.turns, 'strengths')
    const improvements = uniqueThemes(session.turns, 'improvements')
    const review = uniqueThemes(session.turns, 'missingPoints')
    const duration = formatPracticeDuration(session.startedAt)

    // Aggregate qualitative observations
    const techObs = Array.from(
      new Set(
        session.turns.flatMap((t) => t.feedback?.technicalObservations || []).filter(Boolean),
      ),
    ).slice(0, 5)

    const commObs = Array.from(
      new Set(
        session.turns.flatMap((t) => t.feedback?.communicationObservations || []).filter(Boolean),
      ),
    ).slice(0, 5)

    const interviewer = getInterviewerPersona(session.setup.interviewerId)

    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          title="AI Practice Report"
          subtitle="Comprehensive, context-aware summary of your AI interview. Grounded strictly in your spoken answers."
        />
        <Card className="mt-8 p-5 sm:p-6">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                  RoundOne AI Practice Evaluation · Conducted by {interviewer.name}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-navy-950 sm:text-3xl">
                  AI Practice Score:{' '}
                  <span className="text-blue-700">{average == null ? '—' : `${average} / 10`}</span>
                </h2>
              </div>
              <Badge tone="blue">Completed</Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Evaluated on technical knowledge, problem solving, role depth, and communication clarity. This is an
              AI practice score, not an official hiring or employability ranking.
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 border-b border-slate-100 pb-6 sm:grid-cols-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Interviewer</dt>
              <dd className="mt-1 text-sm font-semibold text-navy-950">
                {interviewer.name} <span className="text-xs font-normal text-slate-500">({interviewer.voice})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</dt>
              <dd className="mt-1 text-sm font-semibold text-navy-950">{session.setup.targetRole}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Type</dt>
              <dd className="mt-1 text-sm font-semibold text-navy-950">{session.setup.interviewType}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Questions</dt>
              <dd className="mt-1 text-sm font-semibold text-navy-950">
                {scored.length} of {totalQuestions}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</dt>
              <dd className="mt-1 text-sm font-semibold text-navy-950">{duration ?? '—'}</dd>
            </div>
          </dl>

          {techObs.length > 0 && <SummaryList title="Technical Observations" items={techObs} />}
          {commObs.length > 0 && <SummaryList title="Communication Observations" items={commObs} />}
          <SummaryList title="Observed Strengths" items={strengths} />
          <SummaryList title="Areas to Improve" items={improvements} />
          <SummaryList title="Topics to Practice" items={review} />

          {/* Question Breakdown */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Question Summary & Evaluations
            </h3>
            <div className="mt-4 space-y-4">
              {session.turns.map((turn, idx) => (
                <div key={turn.question.id || idx} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase text-blue-700">Question {idx + 1}</span>
                    {turn.feedback?.score && (
                      <span className="text-xs font-semibold text-navy-900">
                        Score: {turn.feedback.score} / 10
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-navy-950">{turn.question.question}</p>
                  <div className="mt-2 rounded bg-white p-2.5 text-xs text-slate-700 border border-slate-100">
                    <span className="font-semibold text-slate-500">Your response: </span>
                    {turn.answer || '(No response recorded)'}
                  </div>
                  {turn.feedback?.summary && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{turn.feedback.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {persistError ? <p className="mt-4 text-sm text-red-700">{persistError}</p> : null}

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:flex-wrap">
            <Button onClick={restartSetup}>Practice Again</Button>
            <Link to="/candidate/practice/history">
              <Button variant="outline">View Practice History</Button>
            </Link>
            {session.savedSessionId ? (
              <Link to={`/candidate/practice/history/${session.savedSessionId}`}>
                <Button variant="outline">View Saved Session</Button>
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

  // Phase: Intro
  if (session.phase === 'intro') {
    const minutes = estimatedInterviewMinutes(session.setup.questionCount)
    const interviewer = getInterviewerPersona(session.setup.interviewerId)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button
          type="button"
          className="text-sm font-medium text-blue-700"
          onClick={() => setSession({ ...session, phase: 'setup' })}
        >
          ← Back to setup
        </button>
        <PageHeader
          title="You're about to start your AI Interview"
          subtitle="Answer naturally as you would in a real interview."
        />
        <Card className="mt-8 space-y-4 p-5 sm:p-6">
          {/* Selected Interviewer Banner */}
          <div className="flex items-center gap-3.5 rounded-xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 font-bold text-white shadow-sm">
              {interviewer.name[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-navy-950">{interviewer.name}</h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  Voice: {interviewer.voice}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {interviewer.gender}
                </span>
              </div>
              <p className="text-xs font-medium text-blue-700">{interviewer.title}</p>
              <p className="mt-0.5 text-xs text-slate-600">{interviewer.style}</p>
            </div>
          </div>

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
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-navy-950">Voice Interview Guidelines</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-600">
              <li>
                Your interviewer <strong>{interviewer.name}</strong> will speak each question aloud in their{' '}
                <strong>{interviewer.voice}</strong> voice.
              </li>
              <li>Speak your answer into the microphone naturally.</li>
              <li>
                <strong>Comfortable pacing:</strong> If you pause for 2–3 seconds to think, your words won't disappear and
                it will not immediately auto-submit.
              </li>
              <li>
                <strong>Auto-submit countdown:</strong> After extended silence, a 5-second countdown will appear with a
                &ldquo;Keep Speaking&rdquo; button if you need more time.
              </li>
              <li>You can also type or edit your answer directly in the text area at any moment.</li>
            </ul>
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSession({ ...session, phase: 'setup' })} disabled={busy}>
              Edit setup
            </Button>
            <Button onClick={() => void startInterview()} disabled={busy}>
              {busy ? 'Connecting AI Interviewer…' : 'Start Interview'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Phase: Question (Voice Interview Workspace)
  if (session.phase === 'question' && question) {
    const interviewer = getInterviewerPersona(session.setup.interviewerId)

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm font-medium text-red-600 hover:text-red-700"
            onClick={() => setConfirmEndOpen(true)}
          >
            End Interview
          </button>
          <span className="text-sm font-medium text-slate-600">
            Question {session.index + 1} of {totalQuestions}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={session.index + 1} aria-valuemin={1} aria-valuemax={totalQuestions}>
          <div
            className="h-full rounded-full bg-navy-900 transition-[width] duration-300"
            style={{
              width: `${((session.index + 1) / progressDenom) * 100}%`,
            }}
          />
        </div>

        {/* Voice Interview Workspace Card */}
        <Card className="mt-6 p-5 sm:p-6">
          {/* Interviewer Identity & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <VolumeIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Interviewer</p>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    Voice: {interviewer.voice}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-navy-950">
                  {interviewer.name}{' '}
                  <span className="text-xs font-normal text-slate-500">({interviewer.title})</span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="slate">{question.topic}</Badge>
              <Badge tone="slate">{difficultyLabel(question.difficulty)}</Badge>
              {/* Dynamic Status Badges */}
              {voiceState === 'speaking' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                  Speaking…
                </span>
              )}
              {voiceState === 'listening' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
                  Listening…
                </span>
              )}
              {voiceState === 'thinking' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  <span className="h-1.5 w-1.5 animate-spin rounded-full border border-amber-600 border-t-transparent" />
                  Processing answer…
                </span>
              )}
              {voiceState === 'evaluating' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
                  <span className="h-1.5 w-1.5 animate-spin rounded-full border border-purple-600 border-t-transparent" />
                  Evaluating turn…
                </span>
              )}
              {voiceState === 'connecting' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  Connecting voice…
                </span>
              )}
            </div>
          </div>

          {/* Spoken Question */}
          <div className="mt-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question</p>
                <h1 className="mt-1 text-xl font-semibold leading-relaxed text-navy-950 sm:text-2xl">
                  &ldquo;{question.question}&rdquo;
                </h1>
              </div>
              <button
                type="button"
                onClick={handleReplayQuestion}
                aria-label="Replay Question Audio"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <ReplayIcon className="h-3.5 w-3.5" />
                Replay
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Focus: {question.expectedFocus.join(' · ')}
            </p>
          </div>

          {/* Voice Controls & Mic State */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleMuteToggle}
                  aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    micMuted
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  {micMuted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
                </button>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Microphone</p>
                  <p className="text-xs font-semibold text-navy-900">
                    {voiceState === 'speaking'
                      ? 'Paused — interviewer is speaking'
                      : voiceState === 'evaluating'
                        ? 'Paused — evaluating your answer'
                        : micMuted
                          ? 'Muted (Audio paused)'
                          : 'Active (Listening for answer)'}
                  </p>
                </div>
              </div>

              {voiceState === 'speaking' && (
                <button
                  type="button"
                  onClick={() => voiceClientRef.current?.interruptAiSpeech()}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Interrupt AI & Speak
                </button>
              )}
            </div>

            {/* Recognized Candidate Speech / Transcript */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="live-answer-transcript">Your Response (Voice Transcript)</FieldLabel>
                <span className="text-xs text-slate-400">
                  {session.currentAnswer.length}/{PRACTICE_ANSWER_MAX}
                </span>
              </div>
              <TextArea
                id="live-answer-transcript"
                value={session.currentAnswer}
                disabled={busy || voiceState === 'evaluating'}
                onChange={(e) => {
                  const val = e.target.value.slice(0, PRACTICE_ANSWER_MAX)
                  setSession((current) => ({
                    ...current,
                    currentAnswer: val,
                  }))
                  voiceClientRef.current?.setAccumulatedTranscript(val)
                }}
                placeholder="Speak your answer into the microphone. Your words will be transcribed here live."
                className="mt-1 min-h-32 text-sm sm:min-h-36"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Speak naturally. Pausing for a few seconds to think won't erase your words. After extended silence, you'll see a countdown before auto-submitting.
              </p>

              {/* Pause / Auto-submit Countdown Banner */}
              {autoSubmitCountdown !== null && autoSubmitCountdown > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
                    <span>
                      Pause detected. Auto-submitting in <strong>{autoSubmitCountdown}s</strong>...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleKeepSpeaking}
                      className="rounded bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300 shadow-xs hover:bg-amber-100"
                    >
                      Keep Speaking (Wait)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTurnAnswer(session.currentAnswer.trim())}
                      className="rounded bg-navy-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy-800"
                    >
                      Submit Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          {persistError ? <p className="mt-4 text-sm text-red-700">{persistError}</p> : null}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setConfirmEndOpen(true)}
              disabled={busy}
            >
              End Interview
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => void handleTurnAnswer(session.currentAnswer.trim())}
                disabled={busy || session.currentAnswer.trim().length < 8}
              >
                {busy || voiceState === 'evaluating'
                  ? 'Evaluating Answer…'
                  : session.index >= totalQuestions - 1
                  ? 'Submit & Finish'
                  : 'Submit Answer'}
              </Button>
            </div>
          </div>
        </Card>

        {/* End Interview Confirmation Modal */}
        {confirmEndOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <Card className="max-w-md p-6 shadow-xl">
              <h3 className="text-base font-semibold text-navy-950">End AI Interview Early?</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to end this interview? All answers and evaluations recorded up to this point
                will be preserved in your AI Practice Report and History.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setConfirmEndOpen(false)}>
                  Continue Interview
                </Button>
                <Button variant="danger" onClick={confirmEndInterview}>
                  End Now
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // Phase: Setup (Initial screen)
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button
        type="button"
        className="text-sm font-medium text-blue-700"
        onClick={() => navigate('/candidate/practice')}
      >
        ← All practice
      </button>
      <PageHeader
        title="AI Interview setup"
        subtitle="Choose your role, type, topics, and difficulty. You will see an introduction before the interview starts."
      />
      <form
        className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8"
        onSubmit={goToIntro}
      >
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
              onChange={(event) =>
                updateSetup({ difficulty: event.target.value as PracticeDifficulty })
              }
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
                updateSetup({
                  questionCount: Number(event.target.value) as PracticeQuestionCount,
                })
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

        {/* AI Interviewer Persona & Voice Selection */}
        <div>
          <FieldLabel>AI Interviewer & Voice</FieldLabel>
          <p className="mb-3 text-xs text-slate-500">
            Select your AI interviewer. Each interviewer has a distinct speaking voice and interview style.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {INTERVIEWER_PERSONAS.map((persona) => {
              const selected = (session.setup.interviewerId || 'john') === persona.id
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => updateSetup({ interviewerId: persona.id })}
                  className={`flex flex-col rounded-xl border p-3.5 text-left transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-navy-950">{persona.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Voice: {persona.voice}
                    </span>
                  </div>
                  <span className="mt-0.5 text-xs font-medium text-blue-700">{persona.title}</span>
                  <p className="mt-1 text-xs text-slate-600 leading-normal">{persona.style}</p>
                </button>
              )
            })}
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
                  onClick={() =>
                    updateSetup({
                      skills: session.setup.skills.filter((item) => item !== skill),
                    })
                  }
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
  if (items.length === 0)
    return compact ? null : <p className="mt-5 text-sm text-slate-600">{title}: none from this session.</p>
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
