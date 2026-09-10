import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { readJson, writeJson } from '../lib/storage.ts'

const STORAGE_KEY = 'roundone.savedInterviewers'

type SavedContextValue = {
  savedIds: string[]
  isSaved: (id: string) => boolean
  toggleSaved: (id: string) => void
}

const SavedContext = createContext<SavedContextValue | null>(null)

export function SavedProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<string[]>(() => readJson<string[]>(STORAGE_KEY, []))

  const value = useMemo<SavedContextValue>(
    () => ({
      savedIds,
      isSaved: (id) => savedIds.includes(id),
      toggleSaved: (id) => {
        setSavedIds((current) => {
          const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
          writeJson(STORAGE_KEY, next)
          return next
        })
      },
    }),
    [savedIds],
  )

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
}

export function useSavedInterviewers() {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSavedInterviewers must be used within SavedProvider')
  return ctx
}
