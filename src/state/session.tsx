import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { currentCandidate } from '../data/candidate.ts'
import type { Candidate } from '../types.ts'

const SessionContext = createContext<Candidate | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => currentCandidate, [])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used within SessionProvider')
  return session
}
