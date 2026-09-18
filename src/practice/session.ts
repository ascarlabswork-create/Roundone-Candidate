import { removeSession, readSessionJson, writeSessionJson } from '../lib/storage.ts'
import type { PracticeAiQuestion, PracticeSetup, PracticeTurn } from './aiModel.ts'

export type PracticePhase = 'setup' | 'question' | 'feedback' | 'complete'

export type SavedPracticeSession = {
  version: 1
  phase: PracticePhase
  setup: PracticeSetup
  questions: PracticeAiQuestion[]
  index: number
  turns: PracticeTurn[]
  currentAnswer: string
  savedSessionId: string | null
}

const STORAGE_KEY = 'roundone.practice.ai-mock'

export function emptyPracticeSession(): SavedPracticeSession {
  return {
    version: 1,
    phase: 'setup',
    setup: {
      targetRole: '',
      interviewType: '',
      skills: [],
      difficulty: 'intermediate',
      questionCount: 5,
    },
    questions: [],
    index: 0,
    turns: [],
    currentAnswer: '',
    savedSessionId: null,
  }
}

export function readPracticeSession(): SavedPracticeSession {
  const saved = readSessionJson<SavedPracticeSession | null>(STORAGE_KEY, null)
  if (saved?.version !== 1) return emptyPracticeSession()
  return { ...saved, savedSessionId: saved.savedSessionId ?? null }
}

export function writePracticeSession(session: SavedPracticeSession) {
  writeSessionJson(STORAGE_KEY, session)
}

export function clearPracticeSession() {
  removeSession(STORAGE_KEY)
}
