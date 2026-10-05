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
  TextInput,
} from '../components/ui/primitives.tsx'
import { INTERVIEW_TYPES, SKILLS, TARGET_ROLES } from '../data/catalogs.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { isUuid } from '../lib/uuid.ts'
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
import { microphoneFailureMessage, requestPracticeMicrophone } from '../practice/microphoneAccess.ts'
import { PracticeConversation } from '../components/practice/PracticeConversation.tsx'
import { VoiceClient, type VoiceState } from '../practice/voiceClient.ts'
import { getCandidatePreferencesIfPresent, getCandidateSkills } from '../services/candidateProfile.ts'
import { getJobTarget } from '../services/jobTargets.ts'
import { getResumeProjects } from '../services/resumeSkills.ts'
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

function JobPracticeContext({ setup }: { setup: PracticeSetup }) {
  const job = setup.jobContext
  if (!job) return null
  const title = job.jobTitle || 'Saved job'
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Practice for this job</p>
      <p className="mt-1 text-sm font-semibold text-navy-950">
        {title}
        {job.companyName ? ` · ${job.companyName}` : ''}
      </p>
      {job.skills.length > 0 ? <p className="mt-1 text-sm text-slate-600">{job.skills.slice(0, 6).join(', ')}</p> : null}
      <p className="mt-1 text-xs text-slate-500">Practice questions for this role. Not the company's real interview.</p>
    </div>
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
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [resumePrompt, setResumePrompt] = useState(false)
  const [jobNotice, setJobNotice] = useState<string | null>(null)

  const submittingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const voiceClientRef = useRef<VoiceClient | null>(null)
  // Resume-identified projects (formatted) used to ground project questions.
  const resumeProjectsRef = useRef<string[]>([])

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
    const jobTargetId = searchParams.get('job') ?? ''
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
    if (isUuid(jobTargetId)) {
      next.setup = { ...next.setup, jobTargetId }
    }
    setSession(next)
    setError(null)
    setPersistError(null)
    setPrefilled(again)
    setResumePrompt(false)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const id = session.setup.jobTargetId
    if (!id || session.setup.jobContext || session.phase !== 'setup') return
    let cancelled = false
    setJobNotice(null)
    void getJobTarget(id)
      .then((target) => {
        if (cancelled) return
        if (!target) {
          setJobNotice('That saved job is not available for this account. You can still start a general practice interview.')
          setSession((current) => ({
            ...current,
            setup: { ...current.setup, jobTargetId: undefined, jobContext: undefined },
          }))
          return
        }
        const jobContext = {
          companyName: target.companyName ?? '',
          jobTitle: target.jobTitle ?? '',
          description: target.description ?? '',
          skills: target.skills,
        }
        setSession((current) => {
          if (current.setup.jobTargetId !== id) return current
          const skills = dedupeSkills([...jobContext.skills, ...current.setup.skills]).slice(0, 6)
          return {
            ...current,
            setup: {
              ...current.setup,
              jobContext,
              targetRole: jobContext.jobTitle || current.setup.targetRole,
              interviewType: current.setup.interviewType || 'Technical',
              skills: skills.length > 0 ? skills : current.setup.skills,
            },
          }
        })
      })
      .catch(() => {
        if (cancelled) return
        setJobNotice('That saved job could not be loaded. You can still start a general practice interview.')
        setSession((current) => ({
          ...current,
          setup: { ...current.setup, jobTargetId: undefined },
        }))
      })
    return () => {
      cancelled = true
    }
  }, [session.phase, session.setup.jobContext, session.setup.jobTargetId])

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

  // Load resume-identified projects so the interviewer can ground project
  // questions to real resume projects only (never invented ones).
  useEffect(() => {
    if (!account) return
    let cancelled = false
    void getResumeProjects()
      .then((projects) => {
        if (cancelled) return
        resumeProjectsRef.current = projects.map((project) => {
          const tech = project.technologies.length > 0 ? ` [${project.technologies.join(', ')}]` : ''
          const desc = project.description ? ` — ${project.description}` : ''
          return `${project.name}${desc}${tech}`.slice(0, 160)
        })
      })
      .catch(() => {
        /* no resume projects yet */
      })
    return () => {
      cancelled = true
    }
  }, [account])

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
      projects: resumeProjectsRef.current.length > 0 ? resumeProjectsRef.current : undefined,
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

    let micStream: MediaStream | null = null
    try {
      micStream = await requestPracticeMicrophone()
    } catch (caught) {
      submittingRef.current = false
      setBusy(false)
      setError(microphoneFailureMessage(caught))
      return
    }

    let sessionId: string | null = null
    let handedOff = false
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
        micStream.getTracks().forEach((track) => track.stop())
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

      // Initialize voice connection with the microphone already granted on this click.
      await setupVoiceClient(first, micStream)
      handedOff = true
    } catch (caught: unknown) {
      if (!handedOff) micStream.getTracks().forEach((track) => track.stop())
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

  async function enableMicrophone() {
    setError(null)
    let stream: MediaStream
    try {
      stream = await requestPracticeMicrophone()
    } catch (caught) {
      setVoiceState('error')
      setError(microphoneFailureMessage(caught))
      return
    }
    const question = sessionRef.current.questions[sessionRef.current.index]
    if (!question) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    await setupVoiceClient(question, stream)
  }

  async function setupVoiceClient(initialQuestion: PracticeAiQuestion, existingStream?: MediaStream | null) {
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
        if (transcript.trim().length >= 8 && !submittingRef.current) {
          void handleTurnAnswer(transcript.trim())
        }
      },
    })

    voiceClientRef.current = client
    const started = await client.start(sessionRef.current.setup, persona.voice, persona.name, existingStream)
    if (started) {
      setError(null)
      await client.speakQuestion(initialQuestion.question, persona.voice)
    }
  }

  async function handleTurnAnswer(answerText: string) {
    const curSession = sessionRef.current
    const question = curSession.questions[curSession.index]
    if (!question || busy || submittingRef.current || answerText.length < 8) return

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
  const waitingForJob = Boolean(session.setup.jobTargetId && !session.setup.jobContext)
  const canStart =
    Boolean(session.setup.targetRole.trim() && session.setup.interviewType.trim()) &&
    session.setup.skills.length > 0 &&
    !waitingForJob
  const totalQuestions = session.setup.questionCount

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
                  jobround.ai AI Practice Evaluation · Conducted by {interviewer.name}
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
        {session.setup.jobContext ? (
          <div className="mt-6">
            <JobPracticeContext setup={session.setup} />
          </div>
        ) : null}
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
                <strong>{interviewer.name}</strong> asks one question at a time, the way a real interview works.
              </li>
              <li>Answer out loud. If you pause to think and then continue, it is still the same answer.</li>
              <li>There is no pause or stop control during the question. The interviewer waits, then moves on.</li>
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

  if (session.phase === 'question' && question) {
    const interviewer = getInterviewerPersona(session.setup.interviewerId)

    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {session.setup.jobContext ? <JobPracticeContext setup={session.setup} /> : null}
        <PracticeConversation
          interviewerName={interviewer.name}
          interviewerTitle={interviewer.title}
          questionNumber={session.index + 1}
          totalQuestions={totalQuestions}
          currentQuestion={question.question}
          currentAnswer={session.currentAnswer}
          voiceState={voiceState}
          micMuted={false}
          busy={busy}
          error={error}
          persistError={persistError}
          answerMax={PRACTICE_ANSWER_MAX}
          onAnswerChange={(value) => {
            setSession((current) => ({ ...current, currentAnswer: value }))
            voiceClientRef.current?.setAccumulatedTranscript(value)
          }}
          onLeave={() => setConfirmEndOpen(true)}
          onEnableMicrophone={() => void enableMicrophone()}
        />

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
      {waitingForJob ? <p className="mt-4 text-sm text-slate-600">Loading saved job...</p> : null}
      {jobNotice ? <p className="mt-4 text-sm text-slate-600">{jobNotice}</p> : null}
      {session.setup.jobContext ? (
        <div className="mt-4">
          <JobPracticeContext setup={session.setup} />
        </div>
      ) : null}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-slate-700 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p>
          Want questions based on your resume?{' '}
          <span className="text-slate-600">Upload it first so topics and projects stay grounded in your experience.</span>
        </p>
        <Link
          to="/candidate/resume-skills"
          className="mt-2 inline-block shrink-0 font-medium text-blue-700 hover:text-blue-800 sm:mt-0"
        >
          Build skills from resume →
        </Link>
      </div>
      <form
        className="mt-5 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-8"
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
