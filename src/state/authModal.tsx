import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

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

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/'
  }
  return value
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const authParam = params.get('auth')
  const nextFromUrl = safeNextPath(params.get('next'))

  const [open, setOpen] = useState(false)
  const [tab, setTabState] = useState<AuthModalTab>('login')
  const [nextPath, setNextPath] = useState('/')

  useEffect(() => {
    if (authParam === 'login' || authParam === 'register') {
      setTabState(authParam)
      setNextPath(nextFromUrl)
      setOpen(true)
    }
  }, [authParam, nextFromUrl])

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
    (nextTab: AuthModalTab = 'login', next: string = '/') => {
      setTabState(nextTab)
      setNextPath(safeNextPath(next))
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
