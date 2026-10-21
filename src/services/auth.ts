import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import { authErrorMessage, isDuplicateSignup } from './authCopy.ts'

export { authErrorMessage, isDuplicateSignup, parseAuthRateLimitSeconds } from './authCopy.ts'

export type SignUpInput = {
  email: string
  password: string
  fullName: string
  timezone?: string
}

/** Path OAuth/redirect flows return to. Kept relative so the origin stays dynamic. */
export const OAUTH_CALLBACK_PATH = '/candidate/auth/callback'

function buildOAuthRedirect(nextPath?: string): string {
  const url = new URL(OAUTH_CALLBACK_PATH, window.location.origin)
  if (nextPath) url.searchParams.set('next', nextPath)
  return url.toString()
}

export type SignInInput = {
  email: string
  password: string
}

export type SignUpResult = {
  user: User | null
  sessionCreated: boolean
  needsEmailConfirmation: boolean
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('session') || error.name === 'AuthSessionMissingError') return null
    throw new Error(error.message)
  }
  return data.user ?? null
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new Error('You need to sign in to continue.')
  return user
}

export async function signUpCandidate(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      // Where the email-confirmation link returns to. Dynamic origin, never hardcoded.
      emailRedirectTo: new URL(OAUTH_CALLBACK_PATH, window.location.origin).toString(),
      data: {
        full_name: input.fullName.trim(),
        role: 'candidate',
        timezone: input.timezone?.trim() || 'Asia/Kolkata',
      },
    },
  })
  if (error) throw new Error(authErrorMessage(error))
  if (isDuplicateSignup(data.user)) {
    throw new Error('An account with this email already exists. Try signing in instead.')
  }

  return {
    user: data.user ?? null,
    sessionCreated: Boolean(data.session),
    needsEmailConfirmation: Boolean(data.user) && !data.session,
  }
}

export async function resendSignupConfirmation(email: string) {
  const trimmed = email.trim()
  if (!trimmed) throw new Error('Enter your email above first, then resend the confirmation email.')
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmed,
    options: {
      emailRedirectTo: new URL(OAUTH_CALLBACK_PATH, window.location.origin).toString(),
    },
  })
  if (error) throw new Error(authErrorMessage(error))
}

export async function signInCandidate(input: SignInInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })
  if (error) throw new Error(authErrorMessage(error))
  if (!data.user || !data.session) {
    throw new Error('Sign in did not create a session.')
  }
  return data.user
}

/**
 * Start Google OAuth. The browser goes to Google’s account chooser, then
 * returns to `/candidate/auth/callback`. Role is never set client-side: the
 * database `handle_new_user_before` trigger provisions new users as `candidate`.
 */
export async function signInWithGoogle(nextPath?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: buildOAuthRedirect(nextPath),
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw new Error(authErrorMessage(error))
  return data
}

/** Finish Google One Tap. Role stays server-side via handle_new_user_before. */
export async function signInWithGoogleIdToken(token: string, nonce: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
    nonce,
  })
  if (error) throw new Error(authErrorMessage(error))
  if (!data.user || !data.session) throw new Error('Sign in did not create a session.')
  return data.user
}

/** Path where the password-recovery email link lands (public route). */
export const UPDATE_PASSWORD_PATH = '/candidate/update-password'

export async function sendPasswordReset(email: string) {
  const trimmed = email.trim()
  if (!trimmed) throw new Error('Enter your email above first, then choose “Forgot password?”.')
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: new URL(UPDATE_PASSWORD_PATH, window.location.origin).toString(),
  })
  if (error) throw new Error(authErrorMessage(error))
}

/** Set a new password for the currently-recovered/authenticated user. */
export async function updatePassword(newPassword: string) {
  if (newPassword.length < 6) throw new Error('Your password must be at least 6 characters.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(authErrorMessage(error))
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  fail(error)
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => data.subscription.unsubscribe()
}
