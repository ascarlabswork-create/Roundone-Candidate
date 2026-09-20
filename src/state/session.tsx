import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getCurrentUser, onAuthStateChange, signOut as signOutRequest } from '../services/auth.ts'
import { getCandidateProfile, type CandidateAccount } from '../services/candidateProfile.ts'

type SessionStatus = 'loading' | 'anonymous' | 'authenticated'

type SessionContextValue = {
  status: SessionStatus
  user: User | null
  account: CandidateAccount | null
  error: string | null
  refreshAccount: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<CandidateAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyUser = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setUser(null)
      setAccount(null)
      setError(null)
      setStatus('anonymous')
      return
    }

    setUser(nextUser)
    setStatus('authenticated')
    try {
      const nextAccount = await getCandidateProfile({ retries: 6 })
      setAccount(nextAccount)
      setError(null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not load your profile.'
      if (message.includes('only supports candidate')) {
        setAccount(null)
        setError(message)
        return
      }
      setAccount(null)
      setError(message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void getCurrentUser()
      .then((current) => {
        if (!cancelled) return applyUser(current)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setStatus('anonymous')
        setError(caught instanceof Error ? caught.message : 'Could not restore your session.')
      })

    const unsubscribe = onAuthStateChange((nextUser) => {
      if (!cancelled) void applyUser(nextUser)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [applyUser])

  const refreshAccount = useCallback(async () => {
    const current = await getCurrentUser()
    await applyUser(current)
  }, [applyUser])

  const signOut = useCallback(async () => {
    await signOutRequest()
    setUser(null)
    setAccount(null)
    setError(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, account, error, refreshAccount, signOut }),
    [status, user, account, error, refreshAccount, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used within SessionProvider')
  return session
}
