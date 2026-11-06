/** Where to send someone after sign-in when they did not ask for a specific page. */
export const CANDIDATE_WELCOME_PATH = '/candidate/welcome'

/**
 * Booking and other deep links stay as-is.
 * A plain home/dashboard destination goes through the candidate setup page first.
 */
export function postAuthPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return CANDIDATE_WELCOME_PATH
  }
  if (value === '/' || value === '/candidate') return CANDIDATE_WELCOME_PATH
  return value
}
