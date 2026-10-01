import { useEffect, useId } from 'react'
import { Button } from '../ui/Button.tsx'
import { GoogleIcon } from '../ui/GoogleIcon.tsx'

export function GoogleSignInDialog({
  open,
  busy,
  error,
  onGoogle,
  onClose,
}: {
  open: boolean
  busy: boolean
  error: string | null
  onGoogle: () => void
  onClose: () => void
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-end px-4 sm:px-6">
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="pointer-events-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-navy-950">
            Sign in with Google
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">Continue on jobround.ai with your Google account.</p>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" fullWidth disabled={busy} autoFocus onClick={onGoogle}>
            <GoogleIcon className="h-4 w-4" />
            {busy ? 'Opening Google…' : 'Sign in with Google'}
          </Button>
          <Button type="button" variant="outline" fullWidth disabled={busy} onClick={onClose}>
            Use email instead
          </Button>
        </div>
      </div>
    </div>
  )
}
