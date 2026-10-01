import { googleOAuthClientId, signInWithGoogleIdToken } from './auth.ts'

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'

export class GoogleOneTapUnavailable extends Error {
  constructor() {
    super('Google account chooser is not available in this browser.')
    this.name = 'GoogleOneTapUnavailable'
  }
}

export class GoogleOneTapDismissed extends Error {
  constructor() {
    super('Google sign-in was closed.')
    this.name = 'GoogleOneTapDismissed'
  }
}

type CredentialResponse = { credential?: string }

type PromptMoment = {
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
  getSkippedReason?: () => string
}

type GoogleIdApi = {
  initialize: (config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    nonce: string
    use_fedcm_for_prompt: boolean
    auto_select: boolean
    cancel_on_tap_outside: boolean
    context: 'signin'
    itp_support: boolean
  }) => void
  prompt: (momentListener?: (notification: PromptMoment) => void) => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

let scriptPromise: Promise<void> | null = null
let clientIdPromise: Promise<string> | null = null
let initialized = false
let activeNonce = ''
let onCredential: ((credential: string) => void) | null = null

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`)
    const script = existing ?? document.createElement('script')
    script.src = GOOGLE_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Google sign-in.'))
    }
    if (!existing) document.head.appendChild(script)
    if (window.google?.accounts?.id) resolve()
  })
  return scriptPromise
}

async function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const nonce = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
  const hashedNonce = Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { nonce, hashedNonce }
}

function promptOutcome(notification: PromptMoment) {
  if (notification.isNotDisplayed?.()) return 'unavailable' as const
  if (notification.isDismissedMoment?.()) return 'dismissed' as const
  if (!notification.isSkippedMoment?.()) return null
  const reason = notification.getSkippedReason?.()
  if (reason === 'user_cancel' || reason === 'tap_outside') return 'dismissed' as const
  return 'unavailable' as const
}

function googleId() {
  const api = window.google?.accounts?.id
  if (!api) throw new GoogleOneTapUnavailable()
  return api
}

function clientId(nextPath?: string) {
  clientIdPromise ??= googleOAuthClientId(nextPath).catch((error: unknown) => {
    clientIdPromise = null
    throw error
  })
  return clientIdPromise
}

/**
 * Show Google's account chooser in the top-right corner and sign in with the
 * returned ID token. Resolves once a Supabase session exists.
 */
export async function promptGoogleOneTap(nextPath?: string) {
  const [id] = await Promise.all([clientId(nextPath), loadGoogleScript()])
  const api = googleId()

  if (!initialized) {
    const { nonce, hashedNonce } = await createNonce()
    activeNonce = nonce
    api.initialize({
      client_id: id,
      callback: (response) => {
        if (!response.credential || !onCredential) return
        onCredential(response.credential)
      },
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      auto_select: false,
      cancel_on_tap_outside: false,
      context: 'signin',
      itp_support: true,
    })
    initialized = true
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      if (onCredential === handleCredential) onCredential = null
      if (error) reject(error)
      else resolve()
    }

    const handleCredential = (credential: string) => {
      void signInWithGoogleIdToken(credential, activeNonce).then(
        () => finish(),
        (error: unknown) => finish(error),
      )
    }
    onCredential = handleCredential

    api.prompt((notification) => {
      let outcome: ReturnType<typeof promptOutcome> = null
      try {
        outcome = promptOutcome(notification)
      } catch {
        return
      }
      if (outcome === 'unavailable') finish(new GoogleOneTapUnavailable())
      if (outcome === 'dismissed') finish(new GoogleOneTapDismissed())
    })
  })
}

export function cancelGoogleOneTap() {
  window.google?.accounts?.id?.cancel()
}
