const SESSION_KEYS = [
  'roundone.matchingPreferences',
  'roundone.bookingDraft',
  'roundone.practice.ai-mock',
  'roundone.preparation.ai',
]

const LOCAL_KEYS = [
  'roundone.savedInterviewers',
  'roundone.bookings',
  'roundone.reviews',
  'roundone.practice.recent-questions',
]

export function accountDeletionConfirmed(phrase: string) {
  return phrase.trim() === 'DELETE'
}

export function clearCandidateLocalState() {
  for (const key of SESSION_KEYS) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }
  for (const key of LOCAL_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }
}
