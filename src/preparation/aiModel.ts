import { PRACTICE_DIFFICULTIES, isPracticeDifficulty, type PracticeDifficulty } from '../practice/aiModel.ts'

export const PREPARATION_AI_FUNCTION = 'assist-matching'
export const PREPARATION_AI_MODE = 'prepare'
export const PREPARATION_TIMEOUT_MS = 14_000
export const PREPARATION_RESUME_MAX = 8_000
export const PREPARATION_PRIORITIES = ['high', 'medium', 'low'] as const
export const PREPARATION_QUESTION_COUNTS = [3, 5, 8] as const

export type PreparationPriority = (typeof PREPARATION_PRIORITIES)[number]

export const PREPARATION_BANNED =
  /\b(guaranteed|job-ready|hiring probability|employability|will get (you )?hired|definitely be asked|resume is ready|recruiter score)\b/i

export type PreparationInput = {
  targetRole: string
  experienceLevel: string
  skills: string[]
  interviewType: string
  resumeText: string
}

export type PreparationPriorityTopic = {
  topic: string
  reason: string
  priority: PreparationPriority
}

export type PreparationPracticeRecommendation = {
  topic: string
  questionCount: 3 | 5 | 8
  difficulty: PracticeDifficulty
}

export type PreparationResult = {
  profileSummary: string
  priorityTopics: PreparationPriorityTopic[]
  interviewFocusAreas: string[]
  practiceRecommendations: PreparationPracticeRecommendation[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readTrimmed(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function uniqueStrings(values: unknown, maxItems: number, maxLen: number, minLen = 1) {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const item of values) {
    const text = readTrimmed(item, maxLen)
    if (text.length < minLen || PREPARATION_BANNED.test(text)) continue
    if (result.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue
    result.push(text)
    if (result.length >= maxItems) break
  }
  return result
}

function isPriority(value: string): value is PreparationPriority {
  return PREPARATION_PRIORITIES.includes(value as PreparationPriority)
}

export function preparationInputHash(input: PreparationInput) {
  return JSON.stringify({
    targetRole: input.targetRole.trim().toLowerCase(),
    experienceLevel: input.experienceLevel.trim().toLowerCase(),
    skills: input.skills.map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 12),
    interviewType: input.interviewType.trim().toLowerCase(),
    resumeText: input.resumeText.trim().slice(0, PREPARATION_RESUME_MAX).toLowerCase(),
  })
}

export function canGeneratePreparation(input: PreparationInput) {
  return Boolean(input.targetRole.trim() || input.skills.length > 0 || input.resumeText.trim().length >= 40)
}

export function parsePreparationResult(value: unknown): PreparationResult | null {
  const row = asRecord(value)
  if (!row) return null
  const profileSummary = readTrimmed(row.profile_summary ?? row.profileSummary, 320)
  if (profileSummary.length < 20 || PREPARATION_BANNED.test(profileSummary)) return null

  const priorityTopics: PreparationPriorityTopic[] = []
  const rawTopics = Array.isArray(row.priority_topics)
    ? row.priority_topics
    : Array.isArray(row.priorityTopics)
      ? row.priorityTopics
      : []
  for (const item of rawTopics) {
    const topicRow = asRecord(item)
    if (!topicRow) continue
    const topic = readTrimmed(topicRow.topic, 60)
    const reason = readTrimmed(topicRow.reason, 180)
    const priority = readTrimmed(topicRow.priority, 16).toLowerCase()
    if (topic.length < 2 || reason.length < 8 || PREPARATION_BANNED.test(reason) || !isPriority(priority)) continue
    if (priorityTopics.some((existing) => existing.topic.toLowerCase() === topic.toLowerCase())) continue
    priorityTopics.push({ topic, reason, priority })
    if (priorityTopics.length >= 6) break
  }

  const interviewFocusAreas = uniqueStrings(row.interview_focus_areas ?? row.interviewFocusAreas, 6, 60, 2)

  const practiceRecommendations: PreparationPracticeRecommendation[] = []
  const rawPractice = Array.isArray(row.practice_recommendations)
    ? row.practice_recommendations
    : Array.isArray(row.practiceRecommendations)
      ? row.practiceRecommendations
      : []
  for (const item of rawPractice) {
    const practiceRow = asRecord(item)
    if (!practiceRow) continue
    const topic = readTrimmed(practiceRow.topic, 60)
    const difficultyRaw = readTrimmed(practiceRow.difficulty, 20).toLowerCase()
    const countRaw = practiceRow.question_count ?? practiceRow.questionCount
    const questionCount =
      typeof countRaw === 'number' && PREPARATION_QUESTION_COUNTS.includes(countRaw as 3 | 5 | 8)
        ? (countRaw as 3 | 5 | 8)
        : null
    if (!topic || !isPracticeDifficulty(difficultyRaw) || questionCount == null) continue
    if (practiceRecommendations.some((existing) => existing.topic.toLowerCase() === topic.toLowerCase())) continue
    practiceRecommendations.push({ topic, questionCount, difficulty: difficultyRaw })
    if (practiceRecommendations.length >= 6) break
  }

  if (priorityTopics.length === 0 && interviewFocusAreas.length === 0 && practiceRecommendations.length === 0) {
    return null
  }

  return { profileSummary, priorityTopics, interviewFocusAreas, practiceRecommendations }
}

export function practiceHrefFromPreparation(
  input: PreparationInput,
  result: PreparationResult,
  recommendation?: PreparationPracticeRecommendation,
) {
  const topics = recommendation
    ? [recommendation.topic]
    : [
        ...result.practiceRecommendations.map((item) => item.topic),
        ...result.priorityTopics.map((item) => item.topic),
        ...input.skills,
      ]
  const uniqueTopics = [...new Set(topics.map((item) => item.trim()).filter(Boolean))].slice(0, 6)
  const difficulty =
    recommendation?.difficulty ??
    result.practiceRecommendations[0]?.difficulty ??
    (PRACTICE_DIFFICULTIES.includes('intermediate') ? 'intermediate' : 'intermediate')
  const params = new URLSearchParams({
    again: '1',
    role: input.targetRole.trim().slice(0, 80) || 'Software Engineer',
    type: input.interviewType.trim().slice(0, 60) || 'Coding',
    difficulty,
  })
  if (uniqueTopics.length > 0) params.set('skills', uniqueTopics.join(','))
  return `/candidate/practice/mock?${params.toString()}`
}
