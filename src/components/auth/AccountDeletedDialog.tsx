import { useEffect, useId, useRef } from 'react'
import { useBodyScrollLock } from '../../lib/bodyScrollLock.ts'
import { Button } from '../ui/Button.tsx'

/** Full-screen confirmation after account delete — separate from the sign-in form. */
export function AccountDeletedDialog({
  open,
  onContinue,
}: {
  open: boolean
  onContinue: () => void
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault()
        onContinue()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onContinue])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-navy-950/55 backdrop-blur-sm" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl sm:p-8"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Account</p>
        <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight text-navy-950">
          Your account has been deleted
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your candidate account is gone. You can create a new one with the same email anytime.
        </p>
        <Button type="button" fullWidth className="mt-6" onClick={onContinue}>
          Continue to sign in
        </Button>
      </div>
    </div>
  )
}
