import { useEffect, useId, useRef } from 'react'
import { useBodyScrollLock } from '../../lib/bodyScrollLock.ts'
import { Button } from '../ui/Button.tsx'

/** Compact confirmation after account delete — separate from the sign-in form. */
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
      <div className="absolute inset-0 bg-navy-950/40" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg"
      >
        <h2 id={titleId} className="text-base font-semibold text-navy-950">
          Account deleted successfully
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          You may create a new account with the same email address at any time.
        </p>
        <div className="mt-4 flex justify-end">
          <Button type="button" size="sm" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
