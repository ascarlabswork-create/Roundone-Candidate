import { authErrorMessage, isDuplicateSignup, parseAuthRateLimitSeconds } from './authCopy.ts'

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

console.log('auth.check passed')
