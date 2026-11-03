/** Google Identity Services. Runs on your site origin so Google shows jobround.ai, not supabase.co. */
const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const DEFAULT_GOOGLE_CLIENT_ID = '36438582739-1nvehrporgsk8rvlhr76abn900g1fqra.apps.googleusercontent.com'

export function googleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_CLIENT_ID
}

export type GoogleCredentialResponse = { credential?: string }

type GooglePromptNotification = {
  isNotDisplayed(): boolean
  isSkippedMoment(): boolean
  isDismissedMoment(): boolean
  getNotDisplayedReason(): string
  getSkippedReason(): string
  getDismissedReason(): string
}

type GoogleIdConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce: string
  auto_select: boolean
  cancel_on_tap_outside: boolean
  context: 'signin' | 'signup' | 'use'
  itp_support: boolean
  use_fedcm_for_prompt: boolean
}

export type GoogleAccountsId = {
  initialize(config: GoogleIdConfiguration): void
  prompt(momentListener?: (notification: GooglePromptNotification) => void): void
  cancel(): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

let scriptPromise: Promise<GoogleAccountsId> | null = null

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      const api = window.google?.accounts?.id
      if (api) resolve(api)
      else reject(new Error('Google sign-in did not load.'))
    }
    script.onerror = () => reject(new Error('Google sign-in could not be loaded.'))
    document.head.appendChild(script)
  })
  scriptPromise.catch(() => {
    scriptPromise = null
  })
  return scriptPromise
}

/**
 * Google embeds the hashed nonce in the ID token. Supabase receives the raw
 * nonce, hashes it, and compares, so a stolen token cannot be replayed.
 */
export async function createGoogleNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = btoa(String.fromCharCode(...bytes))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}

/**
 * Opens Google's account chooser on the current site origin (jobround.ai in
 * production). Returns the ID token + raw nonce for supabase.auth.signInWithIdToken.
 * Does not redirect through *.supabase.co, so Google shows "continue to jobround.ai".
 */
export async function promptGoogleIdToken(): Promise<{ credential: string; nonce: string }> {
  const [google, nonce] = await Promise.all([loadGoogleIdentity(), createGoogleNonce()])

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    google.initialize({
      client_id: googleClientId(),
      nonce: nonce.hashed,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      itp_support: true,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        if (!response.credential) {
          finish(() => reject(new Error('Google did not return a sign-in credential. Please try again.')))
          return
        }
        finish(() => resolve({ credential: response.credential!, nonce: nonce.raw }))
      },
    })

    google.prompt((notification) => {
      if (notification.isDismissedMoment()) {
        const reason = notification.getDismissedReason()
        if (reason === 'credential_returned') return
        finish(() => reject(new Error('Google sign-in was cancelled.')))
        return
      }
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        const reason = notification.isNotDisplayed()
          ? notification.getNotDisplayedReason()
          : notification.getSkippedReason()
        finish(() =>
          reject(
            new Error(
              `Google sign-in could not open (${reason}). Allow popups for this site, or try again in a normal browser window.`,
            ),
          ),
        )
      }
    })
  })
}
