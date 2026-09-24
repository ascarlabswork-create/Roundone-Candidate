import { readJson, writeJson } from '../lib/storage.ts'

export const PRACTICE_AI_FUNCTION = 'assist-matching'
export const PRACTICE_QUESTION_TIMEOUT_MS = 12_000
export const PRACTICE_FEEDBACK_TIMEOUT_MS = 8_000
export const PRACTICE_ANSWER_MAX = 4_000
export const PRACTICE_QUESTION_COUNTS = [3, 5, 8] as const
export const PRACTICE_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export const PRACTICE_QUESTION_TYPES = ['technical', 'behavioral', 'system_design', 'product'] as const

export type PracticeDifficulty = (typeof PRACTICE_DIFFICULTIES)[number]
export type PracticeQuestionType = (typeof PRACTICE_QUESTION_TYPES)[number]
export type PracticeQuestionCount = (typeof PRACTICE_QUESTION_COUNTS)[number]

export const PRACTICE_BANNED_CLAIM =
  /\b(ready for the job|you will get hired|hiring decision|guaranteed|employability|interview success probability|real (google|amazon|meta|microsoft|netflix) interview|official interviewer feedback|percentile)\b/i

export type InterviewerVoice = 'echo' | 'shimmer' | 'alloy' | 'nova'

export type InterviewerPersona = {
  id: string
  name: string
  voice: InterviewerVoice
  title: string
  style: string
  gender: string
}

export const INTERVIEWER_PERSONAS: InterviewerPersona[] = [
  {
    id: 'john',
    name: 'John',
    voice: 'echo',
    title: 'Senior Engineering Lead',
    style: 'Calm, technical, and structured',
    gender: 'Male',
  },
  {
    id: 'lily',
    name: 'Lily',
    voice: 'shimmer',
    title: 'Principal Architect',
    style: 'Warm, conversational, and exploratory',
    gender: 'Female',
  },
  {
    id: 'alex',
    name: 'Alex',
    voice: 'alloy',
    title: 'Staff Engineer',
    style: 'Direct, pragmatic, and fast-paced',
    gender: 'Neutral',
  },
  {
    id: 'sarah',
    name: 'Sarah',
    voice: 'nova',
    title: 'Engineering Director',
    style: 'Supportive, depth-focused, and behavioral',
    gender: 'Female',
  },
]

export function getInterviewerPersona(id?: string): InterviewerPersona {
  return INTERVIEWER_PERSONAS.find((p) => p.id === id) ?? INTERVIEWER_PERSONAS[0]
}

export const INTERVIEW_FOCUS_DIMENSIONS = [
  'production incident triage and root-cause analysis',
  'high-concurrency synchronization and race conditions',
  'memory profiling, garbage collection, and resource leak diagnosis',
  'cache invalidation, thundering herd prevention, and consistency',
  'distributed systems latency, timeouts, and graceful degradation',
  'database indexing, query execution plans, and lock contention',
  'API backwards compatibility, idempotency, and versioning',
  'state synchronization, immutability, and side-effect isolation',
  'security vulnerabilities, injection defense, and authorization boundaries',
  'horizontal scaling bottlenecks, sharding, and partitioning',
  'asynchronous task processing, backpressure, and dead-letter queues',
  'observability instrumentation, structured logging, and distributed tracing',
  'architectural boundaries, loose coupling, and dependency inversion',
  'testing strategy, integration test isolation, and flaky test mitigation',
  'refactoring tightly coupled legacy code under production constraints',
  'event-driven architecture, event ordering, and at-least-once delivery',
  'browser rendering bottlenecks, layout thrashing, and event loop behavior',
  'zero-downtime data migration and schema rollbacks',
  'resilient third-party API integration, circuit breakers, and rate-limiting',
  'cost vs performance trade-offs under high request throughput',
  'error handling patterns, panic recovery, and defensive programming',
  'handling traffic spikes, throttling, and load shedding mechanisms',
] as const

export function pickRandomFocusDimension(excludeDimensions: string[] = []): string {
  const excludeLower = new Set(excludeDimensions.map((d) => d.toLowerCase()))
  const available = INTERVIEW_FOCUS_DIMENSIONS.filter((d) => !excludeLower.has(d.toLowerCase()))
  const pool = available.length > 0 ? available : INTERVIEW_FOCUS_DIMENSIONS
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]
}

const STOP_WORDS = new Set([
  'what',
  'which',
  'when',
  'where',
  'would',
  'could',
  'should',
  'about',
  'explain',
  'describe',
  'difference',
  'between',
  'using',
  'your',
  'with',
  'does',
  'have',
  'from',
  'into',
  'that',
  'this',
  'these',
  'those',
  'their',
  'there',
  'please',
  'tell',
  'more',
  'some',
  'such',
  'than',
  'then',
])

function normalizeWordToken(word: string): string {
  return word.toLowerCase().replace(/(ing|ed|es|s)$/, '')
}

export function tokenizeQuestion(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map(normalizeWordToken)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  return new Set(words)
}

export function isQuestionRepetition(candidateQuestion: string, existingQuestion: string): boolean {
  const cNorm = candidateQuestion.trim().toLowerCase()
  const eNorm = existingQuestion.trim().toLowerCase()
  if (cNorm === eNorm) return true

  const tokens1 = tokenizeQuestion(cNorm)
  const tokens2 = tokenizeQuestion(eNorm)
  if (tokens1.size === 0 || tokens2.size === 0) return false

  let intersection = 0
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++
  }
  const union = new Set([...tokens1, ...tokens2]).size
  const jaccard = union > 0 ? intersection / union : 0
  return jaccard >= 0.65
}

const RECENT_QUESTIONS_KEY = 'roundone.practice.recent-questions'
const MAX_RECENT_QUESTIONS = 60

export function getRecentAskedQuestions(): string[] {
  const list = readJson<string[]>(RECENT_QUESTIONS_KEY, [])
  return Array.isArray(list) ? list.filter((q) => typeof q === 'string' && q.trim().length >= 15) : []
}

export function recordAskedQuestion(questionText: string) {
  if (!questionText || questionText.trim().length < 15) return
  const current = getRecentAskedQuestions()
  const trimmed = questionText.trim()
  const updated = [
    trimmed,
    ...current.filter((q) => !isQuestionRepetition(trimmed, q)),
  ].slice(0, MAX_RECENT_QUESTIONS)
  writeJson(RECENT_QUESTIONS_KEY, updated)
}

export function recordAskedQuestions(questionTexts: string[]) {
  if (!Array.isArray(questionTexts) || questionTexts.length === 0) return
  let current = getRecentAskedQuestions()
  for (const q of questionTexts) {
    if (typeof q === 'string' && q.trim().length >= 15) {
      const trimmed = q.trim()
      current = [trimmed, ...current.filter((item) => !isQuestionRepetition(trimmed, item))]
    }
  }
  writeJson(RECENT_QUESTIONS_KEY, current.slice(0, MAX_RECENT_QUESTIONS))
}

export type PracticeSetup = {
  targetRole: string
  interviewType: string
  skills: string[]
  difficulty: PracticeDifficulty
  questionCount: PracticeQuestionCount
  interviewerId?: string
}

export type PracticeAiQuestion = {
  id: string
  question: string
  questionType: PracticeQuestionType
  topic: string
  difficulty: PracticeDifficulty
  expectedFocus: string[]
}

export type PracticeAiFeedback = {
  score: number
  strengths: string[]
  improvements: string[]
  missingPoints: string[]
  summary: string
  technicalObservations?: string[]
  communicationObservations?: string[]
}

export type PracticeTurn = {
  question: PracticeAiQuestion
  answer: string
  feedback: PracticeAiFeedback | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readTrimmed(value: unknown, max = 160) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function uniqueStrings(values: unknown, maxItems: number, maxLen: number, minLen = 1) {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const item of values) {
    const text = readTrimmed(item, maxLen)
    if (text.length < minLen) continue
    if (PRACTICE_BANNED_CLAIM.test(text)) continue
    if (result.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue
    result.push(text)
    if (result.length >= maxItems) break
  }
  return result
}

export function isPracticeDifficulty(value: string): value is PracticeDifficulty {
  return PRACTICE_DIFFICULTIES.includes(value as PracticeDifficulty)
}

export function isPracticeQuestionType(value: string): value is PracticeQuestionType {
  return PRACTICE_QUESTION_TYPES.includes(value as PracticeQuestionType)
}

export function difficultyFromCandidateLevel(level: string): PracticeDifficulty {
  const needle = level.trim().toLowerCase()
  if (['intern', 'new grad', 'junior', 'sde 1'].includes(needle)) return 'beginner'
  if (['staff', 'senior staff', 'principal', 'distinguished', 'director'].includes(needle)) return 'advanced'
  return 'intermediate'
}

export type PracticePriorTurn = {
  question: string
  topic: string
  score: number | null
  missingPoints: string[]
}

function parseOnePracticeQuestion(
  value: unknown,
  setup: PracticeSetup,
  idHint: string,
  banQuestions: Set<string> = new Set(),
): PracticeAiQuestion | null {
  const parsed = asRecord(value)
  if (!parsed) return null
  const question = readTrimmed(parsed.question, 600)
  if (question.length < 20 || PRACTICE_BANNED_CLAIM.test(question)) return null
  const qLower = question.toLowerCase().trim()
  if (banQuestions.has(qLower)) return null
  for (const banned of banQuestions) {
    if (isQuestionRepetition(question, banned)) return null
  }
  const questionTypeRaw = readTrimmed(parsed.question_type ?? parsed.questionType, 40).toLowerCase()
  const difficultyRaw = readTrimmed(parsed.difficulty, 20).toLowerCase()
  const expectedFocus = uniqueStrings(parsed.expected_focus ?? parsed.expectedFocus, 5, 80, 4)
  if (expectedFocus.length < 2) return null
  const topic = readTrimmed(parsed.topic, 40)
  const groundedTopic =
    setup.skills.find((skill) => skill.toLowerCase() === topic.toLowerCase()) ??
    (topic.toLowerCase() === setup.interviewType.toLowerCase() ? setup.interviewType : setup.skills[0] || setup.interviewType)
  return {
    id: idHint,
    question,
    questionType: isPracticeQuestionType(questionTypeRaw) ? questionTypeRaw : 'technical',
    topic: groundedTopic,
    difficulty: isPracticeDifficulty(difficultyRaw) ? difficultyRaw : setup.difficulty,
    expectedFocus,
  }
}

export function parsePracticeQuestions(
  value: unknown,
  setup: PracticeSetup,
): PracticeAiQuestion[] | null {
  const row = asRecord(value)
  if (!row) return null
  const raw = Array.isArray(row.questions) ? row.questions : []
  const questions: PracticeAiQuestion[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const parsed = parseOnePracticeQuestion(item, setup, `pq-${questions.length + 1}`, seen)
    if (!parsed) continue
    seen.add(parsed.question.toLowerCase())
    questions.push(parsed)
    if (questions.length >= setup.questionCount) break
  }
  return questions.length > 0 ? questions : null
}

export function parsePracticeNextQuestion(
  value: unknown,
  setup: PracticeSetup,
  questionNumber: number,
  priorQuestions: string[] = [],
): PracticeAiQuestion | null {
  const row = asRecord(value)
  if (!row) return null
  const ban = new Set(priorQuestions.map((item) => item.toLowerCase()))
  const wrapped = asRecord(row.question)
  if (wrapped) {
    return parseOnePracticeQuestion(wrapped, setup, `pq-${questionNumber}`, ban)
  }
  if (Array.isArray(row.questions) && row.questions[0]) {
    return parseOnePracticeQuestion(row.questions[0], setup, `pq-${questionNumber}`, ban)
  }
  return parseOnePracticeQuestion(row, setup, `pq-${questionNumber}`, ban)
}

export function estimatedInterviewMinutes(questionCount: number) {
  return Math.max(1, questionCount) * 4
}

export function formatPracticeDuration(startedAt: string | null, endedAt = new Date()) {
  if (!startedAt) return null
  const start = new Date(startedAt)
  if (Number.isNaN(start.getTime())) return null
  const minutes = Math.max(1, Math.round((endedAt.getTime() - start.getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`
}

export function parsePracticeFeedback(value: unknown): PracticeAiFeedback | null {
  const row = asRecord(value)
  if (!row) return null
  const score = typeof row.score === 'number' && Number.isFinite(row.score) ? Math.round(row.score) : null
  if (score == null || score < 1 || score > 10) return null
  const summary = readTrimmed(row.summary, 280)
  if (summary.length < 12 || PRACTICE_BANNED_CLAIM.test(summary)) return null
  return {
    score,
    strengths: uniqueStrings(row.strengths, 5, 140, 4),
    improvements: uniqueStrings(row.improvements, 5, 140, 4),
    missingPoints: uniqueStrings(row.missing_points ?? row.missingPoints, 5, 140, 4),
    summary,
    technicalObservations: uniqueStrings(row.technical_observations ?? row.technicalObservations, 4, 140, 4),
    communicationObservations: uniqueStrings(row.communication_observations ?? row.communicationObservations, 4, 140, 4),
  }
}

export function averagePracticeScore(turns: PracticeTurn[]) {
  const scored = turns.filter((turn) => turn.feedback)
  if (scored.length === 0) return null
  const total = scored.reduce((sum, turn) => sum + (turn.feedback?.score ?? 0), 0)
  return Math.round((total / scored.length) * 10) / 10
}

export function uniqueThemes(turns: PracticeTurn[], key: 'strengths' | 'improvements' | 'missingPoints', max = 6) {
  const result: string[] = []
  for (const turn of turns) {
    const values = turn.feedback?.[key] ?? []
    for (const value of values) {
      if (result.some((existing) => existing.toLowerCase() === value.toLowerCase())) continue
      result.push(value)
      if (result.length >= max) return result
    }
  }
  return result
}
