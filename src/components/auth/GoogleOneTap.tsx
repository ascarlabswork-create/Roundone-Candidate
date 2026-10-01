import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { createGoogleNonce, googleClientId, loadGoogleIdentity } from '../../services/googleOneTap.ts'
import { authErrorMessage, signInWithGoogleIdToken } from '../../services/auth.ts'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'

/**
 * Google's own account chooser, anchored to the top-right of the page.
 * Renders nothing of our own. A new account is still provisioned as a candidate
 * by the database trigger.
 */
export function GoogleOneTap() {
  const { status } = useSession()
  const location = useLocation()
  const { pushToast } = useToast()
  const onCallback = location.pathname.startsWith('/candidate/auth/callback')

  useEffect(() => {
    if (status !== 'anonymous' || onCallback) return
    let cancelled = false
    let api: Awaited<ReturnType<typeof loadGoogleIdentity>> | null = null

    void (async () => {
      try {
        const [google, nonce] = await Promise.all([loadGoogleIdentity(), createGoogleNonce()])
        if (cancelled) return
        api = google
        google.initialize({
          client_id: googleClientId(),
          nonce: nonce.hashed,
          auto_select: false,
          cancel_on_tap_outside: false,
          context: 'signin',
          itp_support: true,
          use_fedcm_for_prompt: true,
          callback: (response) => {
            if (!response.credential) return
            signInWithGoogleIdToken(response.credential, nonce.raw).catch((caught: unknown) => {
              pushToast(authErrorMessage(caught))
            })
          },
        })
        google.prompt()
      } catch {
        // The chooser is optional. Continue with Google still starts OAuth.
      }
    })()

    return () => {
      cancelled = true
      api?.cancel()
    }
  }, [status, onCallback, pushToast])

  return null
}
