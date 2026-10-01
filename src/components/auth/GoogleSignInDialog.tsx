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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl sm:p-8"
      >
        <h2 id={titleId} className="text-xl font-semibold text-navy-950">
          Sign in with Google
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Continue on jobround.ai with your Google account. A Google sign-in window will open.
        </p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-col gap-3">
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
