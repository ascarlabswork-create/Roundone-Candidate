import { useEffect, useId, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { AuthForm } from './AuthForm.tsx'
import { useAuthModal } from '../../state/authModal.tsx'
import { useSession } from '../../state/session.tsx'
import { cn } from '../../lib/cn.ts'

export function AuthModal() {
  const { open, tab, nextPath, closeAuth, setTab } = useAuthModal()
  const { status, user } = useSession()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAuth()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previous?.focus()
    }
  }, [open, closeAuth])

  if (!open) return null

  if (status === 'authenticated' && user) {
    return <Navigate to={nextPath} replace />
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
        className="relative flex max-h-[min(92svh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-violet-100 bg-gradient-to-r from-coral-50 via-violet-50 to-sky-50 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-navy-950">
              Welcome to JobRound.ai
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Prepare smarter. Practice better. Move forward with confidence.
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-black/[0.04] hover:text-navy-950"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-black/[0.06] px-5 sm:px-6">
          {(['login', 'register'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
                tab === item ? 'border-coral-600 text-coral-700' : 'border-transparent text-slate-500 hover:text-navy-950',
              )}
              onClick={() => setTab(item)}
            >
              {item === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <AuthForm mode={tab} nextPath={nextPath} idPrefix="modal-auth" onSwitchMode={setTab} />
        </div>
      </div>
    </div>
  )
}
