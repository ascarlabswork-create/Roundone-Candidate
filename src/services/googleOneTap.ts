/** Google Identity Services (One Tap). The OAuth client ID is public. */
const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const DEFAULT_GOOGLE_CLIENT_ID = '36438582739-1nvehrporgsk8rvlhr76abn900g1fqra.apps.googleusercontent.com'

export function googleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_CLIENT_ID
}

export type GoogleCredentialResponse = { credential?: string }

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
  prompt(): void
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
