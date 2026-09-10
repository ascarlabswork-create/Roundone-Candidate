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
  language: 'English',
}

type MatchingContextValue = {
  preferences: MatchingPreferences | null
  setPreferences: (prefs: MatchingPreferences) => void
  clearPreferences: () => void
}

const MatchingContext = createContext<MatchingContextValue | null>(null)

export function MatchingProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<MatchingPreferences | null>(() =>
    readSessionJson<MatchingPreferences | null>(STORAGE_KEY, null),
  )

  const value = useMemo<MatchingContextValue>(
    () => ({
      preferences,
      setPreferences: (prefs) => {
        setPreferencesState(prefs)
        writeSessionJson(STORAGE_KEY, prefs)
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
