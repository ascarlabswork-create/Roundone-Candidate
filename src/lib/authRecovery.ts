import { UPDATE_PASSWORD_PATH } from '../services/auth.ts'

const RECOVERY_SESSION_KEY = 'jobround.candidate_password_recovery'

/** Supabase password recovery puts `type=recovery` in the query string or URL hash. */
export function isAuthRecoveryUrl(href?: string) {
  const raw = href ?? (typeof window !== 'undefined' ? window.location.href : '')
  if (!raw) return false
  try {
    const url = new URL(raw)
    if (url.searchParams.get('type') === 'recovery') return true
  } catch {
    return raw.includes('type=recovery')
  }
  return raw.includes('type=recovery')
}

let memoryRecoveryFlag = false

function recoveryFlagStore() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function markPasswordRecoveryPending() {
  const store = recoveryFlagStore()
  if (store) store.setItem(RECOVERY_SESSION_KEY, '1')
  else memoryRecoveryFlag = true
}

export function isPasswordRecoveryPending() {
  const store = recoveryFlagStore()
  if (store) return store.getItem(RECOVERY_SESSION_KEY) === '1'
  return memoryRecoveryFlag
}

export function clearPasswordRecoveryPending() {
  const store = recoveryFlagStore()
  store?.removeItem(RECOVERY_SESSION_KEY)
  memoryRecoveryFlag = false
}

/** True while following a reset-password link (before the new password is saved). */
export function isInPasswordRecoveryFlow(href?: string) {
  return isAuthRecoveryUrl(href) || isPasswordRecoveryPending()
}

export function passwordUpdatePath() {
  return UPDATE_PASSWORD_PATH
}
