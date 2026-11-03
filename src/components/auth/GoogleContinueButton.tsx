import { useEffect, useRef, useState } from 'react'
import { applyDetectedTimezone, authErrorMessage, signInWithGoogleIdToken } from '../../services/auth.ts'
import { mountGoogleContinueButton } from '../../services/googleOneTap.ts'
import { useSession } from '../../state/session.tsx'

export function GoogleContinueButton({
  mode,
  disabled,
  onSuccess,
  onError,
}: {
  mode: 'login' | 'register'
  disabled?: boolean
  onSuccess?: () => void
  onError?: (message: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { refreshAccount } = useSession()
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || disabled) return
    let disposed = false
    let cleanup: (() => void) | undefined

    void (async () => {
      try {
        cleanup = await mountGoogleContinueButton({
          parent: host,
          context: mode === 'register' ? 'signup' : 'signin',
          text: 'continue_with',
          onCredential: async (credential, nonce) => {
            setBusy(true)
            onError?.('')
            try {
              const user = await signInWithGoogleIdToken(credential, nonce)
              await applyDetectedTimezone(user.id)
              await refreshAccount()
              onSuccess?.()
            } catch (caught) {
              onError?.(authErrorMessage(caught))
            } finally {
              setBusy(false)
            }
          },
          onError: (message) => onError?.(message),
        })
        if (disposed) cleanup()
      } catch (caught) {
        if (!disposed) {
          setLoadError(caught instanceof Error ? caught.message : 'Google sign-in could not be loaded.')
        }
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [disabled, mode, onError, onSuccess, refreshAccount])

  return (
    <div className="relative w-full">
      <div
        ref={hostRef}
        className={`flex min-h-11 w-full justify-center overflow-hidden rounded-xl ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}
      />
      {busy ? <p className="mt-2 text-center text-xs text-slate-500">Signing in with Google…</p> : null}
      {loadError ? <p className="mt-2 text-center text-xs text-red-700">{loadError}</p> : null}
    </div>
  )
}
