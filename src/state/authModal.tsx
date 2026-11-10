import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CANDIDATE_WELCOME_PATH, postAuthPath } from '../lib/postAuthPath.ts'
import { useSession } from './session.tsx'

export type AuthModalTab = 'login' | 'register'

type AuthModalContextValue = {
  open: boolean
  tab: AuthModalTab
  nextPath: string
  openAuth: (tab?: AuthModalTab, nextPath?: string) => void
  closeAuth: () => void
  setTab: (tab: AuthModalTab) => void
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const authParam = params.get('auth')
  const nextFromUrl = postAuthPath(params.get('next'))
  const { status, user } = useSession()

  const [open, setOpen] = useState(false)
  const [tab, setTabState] = useState<AuthModalTab>('login')
  const [nextPath, setNextPath] = useState(CANDIDATE_WELCOME_PATH)

  useEffect(() => {
    if (authParam === 'login' || authParam === 'register') {
      if (status === 'authenticated' && user) {
        setOpen(false)
        const next = new URLSearchParams(params)
        next.delete('auth')
        next.delete('next')
        setParams(next, { replace: true })
        return
      }
      setTabState(authParam)
      setNextPath(nextFromUrl)
      setOpen(true)
    }
  }, [authParam, nextFromUrl, status, user, params, setParams])

  useEffect(() => {
    if (status === 'authenticated' && user) {
      setOpen(false)
    }
  }, [status, user])

  const closeAuth = useCallback(() => {
    setOpen(false)
    if (authParam) {
      const next = new URLSearchParams(params)
      next.delete('auth')
      next.delete('next')
      setParams(next, { replace: true })
    }
  }, [authParam, params, setParams])

  const openAuth = useCallback(
    (nextTab: AuthModalTab = 'login', next: string = CANDIDATE_WELCOME_PATH) => {
      setTabState(nextTab)
      setNextPath(postAuthPath(next))
      setOpen(true)
    },
    [],
  )

  const setTab = useCallback((nextTab: AuthModalTab) => {
    setTabState(nextTab)
  }, [])

  const value = useMemo(
    () => ({ open, tab, nextPath, openAuth, closeAuth, setTab }),
    [open, tab, nextPath, openAuth, closeAuth, setTab],
  )

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider')
  return ctx
}
