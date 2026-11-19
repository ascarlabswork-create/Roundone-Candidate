/** Session flag: candidate finished welcome role/skills setup. */
export const INTENT_READY_KEY = 'roundone.intentReady'

function storageKey(userId?: string | null) {
  const id = userId?.trim()
  return id ? `${INTENT_READY_KEY}.${id}` : INTENT_READY_KEY
}

/** When userId is set, only the per-user flag counts (never a previous account's legacy flag). */
export function isIntentReadyCached(userId?: string | null) {
  try {
    if (userId) return sessionStorage.getItem(storageKey(userId)) === '1'
    return sessionStorage.getItem(INTENT_READY_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntentReady(userId?: string | null) {
  try {
    sessionStorage.setItem(storageKey(userId), '1')
    if (userId) sessionStorage.removeItem(INTENT_READY_KEY)
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

/** Clear every welcome-complete flag (sign-out / account deletion). */
export function clearIntentReadyFlags() {
  try {
    const toRemove: string[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (key && (key === INTENT_READY_KEY || key.startsWith(`${INTENT_READY_KEY}.`))) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) sessionStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
