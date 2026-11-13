/** Mask an email for OTP screens (e.g. s******y@g*ail.com). */
export function maskEmailAddress(email: string) {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0) return trimmed
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const maskedLocal =
    local.length <= 2
      ? `${local[0] ?? ''}*`
      : `${local[0]}${'*'.repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}`
  const [host, ...rest] = domain.split('.')
  const maskedHost =
    !host || host.length <= 2 ? `${host?.[0] ?? '*'}*` : `${host[0]}*${host[host.length - 1]}`
  return `${maskedLocal}@${[maskedHost, ...rest].join('.')}`
}

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
    return 'Incorrect email or password. If you created this account with Google, use Continue with Google. To sign in with email, choose Forgot password and set a password.'
  }
  if (
    message.includes('token has expired') ||
    message.includes('otp has expired') ||
    message.includes('otp_expired') ||
    message.includes('email link is invalid or has expired')
  ) {
    return 'That code has expired. Choose Resend code and try again.'
  }
  if (
    message.includes('invalid otp') ||
    message.includes('otp is invalid') ||
    message.includes('token is invalid') ||
    message.includes('invalid token')
  ) {
    return 'That code is incorrect. Check the email and try again, or resend a new code.'
  }
  if (
    message.includes('signups not allowed') ||
    message.includes('user not found') ||
    message.includes('unable to validate email address: invalid')
  ) {
    return 'No account found for that email. Create an account, or use Continue with Google.'
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
  if (
    message.includes('error sending confirmation email') ||
    message.includes('error sending magic link email') ||
    message.includes('error sending email')
  ) {
    return 'We could not send an email right now. Use Continue with Google, or try again in a few minutes.'
  }
  if (message.includes('email address not authorized')) {
    return 'This email cannot receive sign-up mail yet. Use Continue with Google, or contact support.'
  }
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'Google sign-in is not enabled yet. Use email and password for now.'
  }
  if (message.includes('nonce')) {
    return 'Google sign-in could not be verified. Please try again.'
  }
  return raw || 'Something went wrong. Please try again.'
}
