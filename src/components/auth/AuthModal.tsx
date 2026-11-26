import { useEffect, useId, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { AuthForm } from './AuthForm.tsx'
import { useAuthModal } from '../../state/authModal.tsx'
import { useSession } from '../../state/session.tsx'
import { cn } from '../../lib/cn.ts'
import { useBodyScrollLock } from '../../lib/bodyScrollLock.ts'

export function AuthModal() {
  const { open, tab, nextPath, closeAuth, setTab } = useAuthModal()
  const { status, user } = useSession()
  const { pathname } = useLocation()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const showDialog = open && !(status === 'authenticated' && user)

  useBodyScrollLock(showDialog)

  useEffect(() => {
    if (open && status === 'authenticated' && user) {
      closeAuth()
    }
  }, [open, status, user, closeAuth])

  useEffect(() => {
    if (!showDialog) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAuth()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [showDialog, closeAuth])

  if (!open) return null

  if (status === 'authenticated' && user) {
    if (pathname !== nextPath) {
      return <Navigate to={nextPath} replace />
    }
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm"
        aria-label="Close sign in dialog"
        onClick={closeAuth}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[min(88svh,560px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-coral-50 via-violet-50 to-sky-50 px-4 py-3 sm:px-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-navy-950">
              Welcome to JobRound.ai
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Prepare smarter. Practice better.
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/[0.04] hover:text-navy-950"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-black/[0.06] px-4 sm:px-5">
          {(['login', 'register'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                tab === item ? 'border-coral-600 text-coral-700' : 'border-transparent text-slate-500 hover:text-navy-950',
              )}
              onClick={() => setTab(item)}
            >
              {item === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-4">
          <AuthForm
            mode={tab}
            nextPath={nextPath}
            idPrefix="modal-auth"
            onSwitchMode={setTab}
            showModeLinks={false}
          />
        </div>
      </div>
    </div>
  )
}
