export function parseAuthRateLimitSeconds(message: string) {
  const match = message.match(/after (\d+) seconds?/i)
  if (!match) return null
  const seconds = Number(match[1])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export function isDuplicateSignup(user: { identities?: unknown[] } | null) {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0)
}

/** Turn Supabase auth errors into clear, safe candidate-facing messages. */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const message = raw.toLowerCase()

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password') ||
    message.includes('wrong password') ||
    message.includes('incorrect password') ||
    message.includes('invalid password')
  ) {
    return 'Incorrect email or password. Please try again.'
  }
  if (message.includes('email not confirmed') || message.includes('not confirmed')) {
    return 'Please confirm your email from the link we sent, then sign in.'
  }
  if (message.includes('invalid email') || message.includes('unable to validate email')) {
    return 'Enter a valid email address.'
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (message.includes('rate limit') || message.includes('too many') || message.includes('for security purposes')) {
    const wait = parseAuthRateLimitSeconds(raw)
    return wait
      ? `Please wait ${wait} seconds before requesting another email.`
      : 'Too many email requests. Please wait a moment and try again.'
  }
  if (
    message.includes('at least 6') ||
    message.includes('password should be') ||
    message.includes('password must be') ||
    message.includes('password is too short') ||
    message.includes('weak password')
  ) {
    return 'Your password must be at least 6 characters.'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Network error. Check your connection and try again.'
  }
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'Google sign-in is not enabled yet. Use email and password for now.'
  }
  if (message.includes('nonce')) {
    return 'Google sign-in could not be verified. Please try again.'
  }
  return raw || 'Something went wrong. Please try again.'
}
