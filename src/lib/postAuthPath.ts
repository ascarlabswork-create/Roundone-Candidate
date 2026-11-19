/** Where to send someone after sign-in when they did not ask for a specific page. */
export const CANDIDATE_WELCOME_PATH = '/candidate/welcome'

/**
 * Booking and other deep links stay as-is.
 * Bare home (`/`) goes to welcome; Home then sends ready accounts to the dashboard.
 */
export function postAuthPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return CANDIDATE_WELCOME_PATH
  }
  if (value === '/' || value === '/candidate' || value === '/candidate/') {
    return CANDIDATE_WELCOME_PATH
  }
  return value
}
