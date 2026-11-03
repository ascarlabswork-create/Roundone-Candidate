import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { createGoogleNonce, googleClientId, loadGoogleIdentity } from '../../services/googleOneTap.ts'
import { authErrorMessage, signInWithGoogleIdToken } from '../../services/auth.ts'
import { useAuthModal } from '../../state/authModal.tsx'
import { useSession } from '../../state/session.tsx'
import { useToast } from '../../state/toast.tsx'

/**
 * Optional Google One Tap. Skipped while the auth modal is open so it does not
 * fight the official Continue with Google button (which keeps jobround.ai branding).
 */
export function GoogleOneTap() {
  const { status } = useSession()
  const { open: authModalOpen } = useAuthModal()
  const location = useLocation()
  const { pushToast } = useToast()
  const onCallback = location.pathname.startsWith('/candidate/auth/callback')

  useEffect(() => {
    if (status !== 'anonymous' || onCallback || authModalOpen) return
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
          use_fedcm_for_prompt: false,
          callback: (response) => {
            if (!response.credential) return
            signInWithGoogleIdToken(response.credential, nonce.raw).catch((caught: unknown) => {
              pushToast(authErrorMessage(caught))
            })
          },
        })
        google.prompt()
      } catch {
        // Optional. The auth form mounts Google's official button instead.
      }
    })()

    return () => {
      cancelled = true
      api?.cancel()
    }
  }, [status, onCallback, authModalOpen, pushToast])

  return null
}
