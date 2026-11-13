import { authErrorMessage, isDuplicateSignup, maskEmailAddress, parseAuthRateLimitSeconds } from './authCopy.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(parseAuthRateLimitSeconds('For security purposes, you can only request this after 58 seconds.') === 58, 'rate-limit seconds parse')
expect(parseAuthRateLimitSeconds('Too many requests') === null, 'unrelated messages have no wait')
expect(
  authErrorMessage(new Error('For security purposes, you can only request this after 58 seconds.')).includes('58 seconds'),
  'rate-limit copy is user facing',
)
expect(isDuplicateSignup({ identities: [] } as never), 'empty identities is a duplicate signup')
expect(!isDuplicateSignup({ identities: [{ id: '1' }] } as never), 'real identities are not treated as duplicates')
expect(
  authErrorMessage(new Error('Invalid login credentials')).includes('Continue with Google'),
  'sign-in failures are not treated as short passwords',
)
expect(
  authErrorMessage(new Error('Password should be at least 6 characters')) === 'Your password must be at least 6 characters.',
  'short-password signup still maps correctly',
)
expect(
  authErrorMessage(new Error('Token has expired or is invalid')).includes('expired') ||
    authErrorMessage(new Error('otp_expired')).includes('expired'),
  'expired OTP copy is clear',
)
expect(authErrorMessage(new Error('Invalid OTP')).includes('incorrect'), 'invalid OTP copy is clear')
expect(maskEmailAddress('srimadhanduddelly@gmail.com').includes('@'), 'email mask keeps domain')
expect(maskEmailAddress('srimadhanduddelly@gmail.com').startsWith('s'), 'email mask keeps first letter')
expect(!maskEmailAddress('srimadhanduddelly@gmail.com').includes('rimadhanduddell'), 'email mask hides most of local part')

console.log('auth.check passed')
