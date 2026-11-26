const KEY = 'roundone.password-sign-in'

/** Stays true until the document unloads so a client-side redirect cannot race the browser prompt. */
let navigating = false

export function markPasswordSignIn() {
  navigating = false
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // Private mode can block storage; the in-memory flag still covers this page.
  }
}

export function clearPasswordSignIn() {
  navigating = false
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function isPasswordSignInPending() {
  if (navigating) return true
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Full navigation so the browser can offer to save the password on the next page. */
export function finishPasswordSignIn(path: string) {
  if (navigating || !isPasswordSignInPending()) return
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return
  navigating = true
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  window.location.replace(path)
}
