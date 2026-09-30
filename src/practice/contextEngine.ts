import type {
  PracticeAiFeedback,
  PracticeAiQuestion,
  PracticeDifficulty,
  PracticeJobContext,
  PracticeSetup,
  PracticeTurn,
} from './aiModel.ts'

export type CandidateContext = {
  role: string
  level: string
  skills: string[]
  headline?: string
  bio?: string
  /** Resume-identified projects, used to ground project questions. */
  projects?: string[]
}

export type InterviewContext = {
  type: string
  difficulty: PracticeDifficulty
  topics: string[]
  question_count: number
}

export type AdaptiveState = {
  current_question: number
  tested_topics: string[]
  untested_topics: string[]
  strengths: string[]
  weaknesses: string[]
  difficulty: PracticeDifficulty
}

export type InterviewTurnContext = {
  question: string
  topic: string
  answer: string
  score: number | null
  strengths?: string[]
  improvements?: string[]
  missing_points?: string[]
}

export type JobPracticeContext = {
  company_name: string
  job_title: string
  description: string
  skills: string[]
}

export type StructuredInterviewContext = {
  candidate: CandidateContext
  interview: InterviewContext
  state: AdaptiveState
  turns: InterviewTurnContext[]
  job?: JobPracticeContext
}

export function toSafeJobContext(job: PracticeJobContext | null | undefined): JobPracticeContext | null {
  if (!job) return null
  const company_name = job.companyName.replace(/<[^>]*>/g, '').trim().slice(0, 120)
  const job_title = job.jobTitle.replace(/<[^>]*>/g, '').trim().slice(0, 160)
  const description = job.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 4000)
  const skills: string[] = []
  for (const item of job.skills) {
    const skill = item.replace(/<[^>]*>/g, '').trim().slice(0, 40)
    if (!skill) continue
    if (skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) continue
    skills.push(skill)
    if (skills.length >= 12) break
  }
  if (!company_name && !job_title && !description && skills.length === 0) return null
  return { company_name, job_title, description, skills }
}

function interviewTopics(setup: PracticeSetup) {
  const own = setup.skills.map((skill) => skill.trim()).filter(Boolean)
  const jobSkills = (setup.jobContext?.skills ?? []).map((skill) => skill.trim()).filter(Boolean)
  if (jobSkills.length === 0) {
    return own.length > 0 ? own : [setup.interviewType || 'General']
  }
  const merged: string[] = []
  for (const skill of [...jobSkills, ...own]) {
    if (merged.some((item) => item.toLowerCase() === skill.toLowerCase())) continue
    merged.push(skill)
    if (merged.length >= 8) break
  }
  return merged.length > 0 ? merged : [setup.interviewType || 'General']
}

export function buildInitialAdaptiveState(setup: PracticeSetup): AdaptiveState {
  const topics = interviewTopics(setup)
  return {
    current_question: 1,
    tested_topics: [],
    untested_topics: topics.length > 0 ? topics : [setup.interviewType || 'General'],
    strengths: [],
    weaknesses: [],
    difficulty: setup.difficulty,
  }
}

export function adaptDifficulty(
  currentDifficulty: PracticeDifficulty,
  recentScores: number[],
): PracticeDifficulty {
  if (recentScores.length === 0) return currentDifficulty

  const latestScore = recentScores[recentScores.length - 1]
  const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length

  if (currentDifficulty === 'beginner') {
    if (latestScore >= 8 || avgRecent >= 7.5) {
      return 'intermediate'
    }
    return 'beginner'
  }

  if (currentDifficulty === 'intermediate') {
    if (recentScores.length >= 2 && recentScores.slice(-2).every((s) => s >= 8)) {
      return 'advanced'
    }
    if (latestScore <= 3 || (recentScores.length >= 2 && avgRecent <= 4)) {
      return 'beginner'
    }
    return 'intermediate'
  }

  if (currentDifficulty === 'advanced') {
    if (latestScore <= 4 || (recentScores.length >= 2 && avgRecent <= 5)) {
      return 'intermediate'
    }
    return 'advanced'
  }

  return currentDifficulty
}

export function updateAdaptiveState(
  currentState: AdaptiveState,
  question: PracticeAiQuestion,
  _answer: string,
  feedback: PracticeAiFeedback | null,
  allTopics: string[],
): AdaptiveState {
  const testedSet = new Set(currentState.tested_topics.map((t) => t.toLowerCase()))
  if (question.topic) {
    testedSet.add(question.topic.toLowerCase())
  }

  const testedTopics = allTopics.filter((t) => testedSet.has(t.toLowerCase()))
  const untestedTopics = allTopics.filter((t) => !testedSet.has(t.toLowerCase()))

  const strengthsSet = new Set(currentState.strengths)
  const weaknessesSet = new Set(currentState.weaknesses)

  if (feedback) {
    feedback.strengths.forEach((s) => strengthsSet.add(s))
    feedback.improvements.forEach((i) => weaknessesSet.add(i))
    feedback.missingPoints.forEach((m) => weaknessesSet.add(m))
  }

  const recentScores = feedback ? [feedback.score] : []
  const nextDifficulty = adaptDifficulty(currentState.difficulty, recentScores)

  return {
    current_question: currentState.current_question + 1,
    tested_topics: testedTopics,
    untested_topics: untestedTopics,
    strengths: Array.from(strengthsSet).slice(0, 8),
    weaknesses: Array.from(weaknessesSet).slice(0, 8),
    difficulty: nextDifficulty,
  }
}

export function buildStructuredContext(
  candidate: CandidateContext,
  setup: PracticeSetup,
  turns: PracticeTurn[],
): StructuredInterviewContext {
  const allTopics = interviewTopics(setup)
  const job = toSafeJobContext(setup.jobContext)

  let state = buildInitialAdaptiveState(setup)
  const scores: number[] = []

  turns.forEach((turn, idx) => {
    state.current_question = idx + 1
    if (turn.feedback) scores.push(turn.feedback.score)
    state = updateAdaptiveState(state, turn.question, turn.answer, turn.feedback, allTopics)
  })

  state.current_question = turns.length + 1
  state.difficulty = adaptDifficulty(setup.difficulty, scores)

  const turnContexts: InterviewTurnContext[] = turns.map((t) => ({
    question: t.question.question,
    topic: t.question.topic,
    answer: t.answer,
    score: t.feedback?.score ?? null,
    strengths: t.feedback?.strengths,
    improvements: t.feedback?.improvements,
    missing_points: t.feedback?.missingPoints,
  }))

  return {
    candidate: {
      role: candidate.role.trim().slice(0, 80),
      level: candidate.level.trim().slice(0, 40),
      skills: candidate.skills.map((s) => s.trim().slice(0, 40)).filter(Boolean).slice(0, 8),
      headline: candidate.headline?.trim().slice(0, 120),
      bio: candidate.bio?.trim().slice(0, 300),
      projects: (candidate.projects ?? []).map((p) => p.trim().slice(0, 160)).filter(Boolean).slice(0, 8),
    },
    interview: {
      type: setup.interviewType.trim().slice(0, 60),
      difficulty: state.difficulty,
      topics: job ? allTopics.slice(0, 8) : allTopics.slice(0, 6),
      question_count: setup.questionCount,
    },
    state,
    turns: turnContexts,
    ...(job ? { job } : {}),
  }
}
