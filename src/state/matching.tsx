import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { readSessionJson, removeSession, writeSessionJson } from '../lib/storage.ts'
import type { MatchingPreferences } from '../types.ts'

const STORAGE_KEY = 'roundone.matchingPreferences'

const emptyPreferences: MatchingPreferences = {
  targetRole: '',
  candidateLevel: '',
  interviewType: '',
  targetCompany: '',
  skills: [],
  preferredDate: '',
  preferredTime: '',
  budget: 0,
  language: '',
}

function withoutBudgetAndLanguage(prefs: MatchingPreferences): MatchingPreferences {
  return { ...prefs, budget: 0, language: '' }
}

type MatchingContextValue = {
  preferences: MatchingPreferences | null
  setPreferences: (prefs: MatchingPreferences) => void
  clearPreferences: () => void
}

const MatchingContext = createContext<MatchingContextValue | null>(null)

export function MatchingProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<MatchingPreferences | null>(() => {
    const stored = readSessionJson<MatchingPreferences | null>(STORAGE_KEY, null)
    return stored ? withoutBudgetAndLanguage(stored) : null
  })

  const value = useMemo<MatchingContextValue>(
    () => ({
      preferences,
      setPreferences: (prefs) => {
        const next = withoutBudgetAndLanguage(prefs)
        setPreferencesState(next)
        writeSessionJson(STORAGE_KEY, next)
      },
      clearPreferences: () => {
        setPreferencesState(null)
        removeSession(STORAGE_KEY)
      },
    }),
    [preferences],
  )

  return <MatchingContext.Provider value={value}>{children}</MatchingContext.Provider>
}

export function useMatching() {
  const ctx = useContext(MatchingContext)
  if (!ctx) throw new Error('useMatching must be used within MatchingProvider')
  return ctx
}

export { emptyPreferences }
