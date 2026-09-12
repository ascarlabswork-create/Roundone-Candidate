import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'

export type SignUpInput = {
  email: string
  password: string
  fullName: string
  timezone?: string
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
      data: {
        full_name: input.fullName.trim(),
        role: 'candidate',
        timezone: input.timezone?.trim() || 'Asia/Kolkata',
      },
    },
  })
  fail(error)

  return {
    user: data.user ?? null,
    sessionCreated: Boolean(data.session),
    needsEmailConfirmation: Boolean(data.user) && !data.session,
  }
}

export async function signInCandidate(input: SignInInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })
  fail(error)
  if (!data.user || !data.session) {
    throw new Error('Sign in did not create a session.')
  }
  return data.user
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
