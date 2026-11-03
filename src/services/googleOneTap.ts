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

type GoogleButtonConfig = {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number | string
}

type GoogleIdConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce?: string
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  itp_support?: boolean
  use_fedcm_for_prompt?: boolean
}

export type GoogleAccountsId = {
  initialize(config: GoogleIdConfiguration): void
  prompt(momentListener?: (notification: GooglePromptNotification) => void): void
  renderButton(parent: HTMLElement, config: GoogleButtonConfig): void
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

export type MountGoogleButtonOptions = {
  parent: HTMLElement
  context?: 'signin' | 'signup'
  text?: GoogleButtonConfig['text']
  onCredential: (credential: string, nonce: string) => void | Promise<void>
  onError?: (message: string) => void
}

/**
 * Official Google button on the current origin → account chooser says
 * "continue to jobround.ai" (not *.supabase.co). More reliable than prompt()
 * inside modals.
 */
export async function mountGoogleContinueButton(options: MountGoogleButtonOptions): Promise<() => void> {
  const [google, nonce] = await Promise.all([loadGoogleIdentity(), createGoogleNonce()])
  let rawNonce = nonce.raw
  let hashedNonce = nonce.hashed
  let cancelled = false

  const refreshNonce = async () => {
    const next = await createGoogleNonce()
    rawNonce = next.raw
    hashedNonce = next.hashed
  }

  const paint = async () => {
    if (cancelled) return
    await refreshNonce()
    if (cancelled) return

    google.cancel()
    google.initialize({
      client_id: googleClientId(),
      nonce: hashedNonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: options.context ?? 'signin',
      itp_support: true,
      // FedCM prompt() is flaky in modals; the official button does not need it.
      use_fedcm_for_prompt: false,
      callback: (response) => {
        if (!response.credential) {
          options.onError?.('Google did not return a sign-in credential. Please try again.')
          return
        }
        void Promise.resolve(options.onCredential(response.credential, rawNonce)).catch((caught: unknown) => {
          options.onError?.(caught instanceof Error ? caught.message : 'Google sign-in failed.')
        })
      },
    })

    options.parent.innerHTML = ''
    const width = Math.min(400, Math.max(240, Math.floor(options.parent.clientWidth || 320)))
    google.renderButton(options.parent, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: options.text ?? 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width,
    })
  }

  let lastWidth = 0
  await paint()
  lastWidth = Math.floor(options.parent.clientWidth || 0)

  const observer =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const nextWidth = Math.floor(options.parent.clientWidth || 0)
          if (Math.abs(nextWidth - lastWidth) < 12) return
          lastWidth = nextWidth
          void paint()
        })
      : null
  observer?.observe(options.parent)

  return () => {
    cancelled = true
    observer?.disconnect()
    google.cancel()
    options.parent.innerHTML = ''
  }
}
