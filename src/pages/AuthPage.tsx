import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, PageHeader, PasswordInput, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { GoogleIcon } from '../components/ui/GoogleIcon.tsx'
import { timezoneSelectOptions } from '../lib/candidateTimezone.ts'
import {
  authErrorMessage,
  parseAuthRateLimitSeconds,
  resendSignupConfirmation,
  sendPasswordReset,
  signInCandidate,
  signInWithGoogle,
  signUpCandidate,
} from '../services/auth.ts'
import { useSession } from '../state/session.tsx'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/'
  }
  return value
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, user, error: sessionError, refreshAccount } = useSession()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resetWait, setResetWait] = useState(0)

  if (status === 'authenticated' && user) {
    return <Navigate to={nextPath} replace />
  }

  const isRegister = mode === 'register'
  const busy = submitting || googleSubmitting || emailBusy || status === 'loading'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      if (isRegister) {
        const result = await signUpCandidate({ email, password, fullName, timezone })
        if (result.needsEmailConfirmation) {
          setNeedsConfirmation(true)
          setInfo('We sent a confirmation link to your email. Check your inbox and spam folder, then sign in.')
          return
        }
        await refreshAccount()
      } else {
        await signInCandidate({ email, password })
        await refreshAccount()
      }
    } catch (caught) {
      const message = authErrorMessage(caught)
      setError(message)
      if (message.includes('confirm your email')) setNeedsConfirmation(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function continueWithGoogle() {
    setError(null)
    setInfo(null)
    setGoogleSubmitting(true)
    try {
      await signInWithGoogle(nextPath)
    } catch (caught) {
      setError(authErrorMessage(caught))
      setGoogleSubmitting(false)
    }
  }

  function startResetWait(seconds: number) {
    setResetWait(seconds)
    const started = Date.now()
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, seconds - Math.ceil((Date.now() - started) / 1000))
      setResetWait(remaining)
      if (remaining <= 0) window.clearInterval(timer)
    }, 1000)
  }

  async function forgotPassword() {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError('Enter your email above first, then choose “Forgot password?”.')
      return
    }
    setEmailBusy(true)
    try {
      await sendPasswordReset(email)
      setInfo('If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.')
      startResetWait(60)
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : ''
      const wait = parseAuthRateLimitSeconds(raw)
      if (wait) startResetWait(wait)
      setError(authErrorMessage(caught))
    } finally {
      setEmailBusy(false)
    }
  }

  async function resendConfirmation() {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError('Enter your email above first, then resend the confirmation email.')
      return
    }
    setEmailBusy(true)
    try {
      await resendSignupConfirmation(email)
      setInfo('We sent another confirmation email. Check your inbox and spam folder.')
      startResetWait(60)
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : ''
      const wait = parseAuthRateLimitSeconds(raw)
      if (wait) startResetWait(wait)
      setError(authErrorMessage(caught))
    } finally {
      setEmailBusy(false)
    }
  }

  return (
    <div className="studio-grid">
      <div className="mx-auto grid max-w-6xl items-stretch gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
        <div className="studio-ink hidden flex-col justify-between rounded-[2rem] p-10 text-white lg:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">jobround.ai</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">
              Your next interview should not be the first time you hear the question.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
              Sign in to book live mocks with working professionals, run AI practice, and keep every scorecard in one
              place.
            </p>
          </div>
          <p className="text-sm text-slate-400">Mock interviews with people who have sat on the hiring side.</p>
        </div>
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
      <PageHeader
        title={isRegister ? 'Create your candidate account' : 'Sign in'}
        subtitle={
          isRegister
            ? 'We’ll use this account for your profile, preferences, and later bookings.'
            : 'Sign in to view and edit your candidate profile.'
        }
      />

      <Card className="mt-8 p-6 sm:p-8">
        <form className="space-y-4" onSubmit={submit}>
          {isRegister ? (
            <div>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <TextInput
                id="fullName"
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
          ) : null}
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              {!isRegister ? (
                <button
                  type="button"
                  onClick={() => void forgotPassword()}
                  disabled={busy || resetWait > 0}
                  className="text-xs font-medium text-coral-700 hover:underline disabled:text-slate-400"
                >
                  {resetWait > 0 ? `Wait ${resetWait}s` : 'Forgot password?'}
                </button>
              ) : null}
            </div>
            <PasswordInput
              id="password"
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {isRegister ? (
            <div>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <PasswordInput
                id="confirmPassword"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          ) : null}
          {isRegister ? (
            <div>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <SelectInput
                id="timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {timezoneSelectOptions(timezone).map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </SelectInput>
            </div>
          ) : null}

          {!isRegister ? (
            <p className="text-xs text-slate-500">
              Accounts created with Google have no password. Use Continue with Google, or Forgot password to set one.
            </p>
          ) : null}
          {error || sessionError ? <p className="text-sm text-red-700">{error || sessionError}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          {needsConfirmation ? (
            <button
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={busy || resetWait > 0}
              className="text-sm font-medium text-coral-700 hover:underline disabled:text-slate-400"
            >
              {resetWait > 0 ? `Resend available in ${resetWait}s` : 'Resend confirmation email'}
            </button>
          ) : null}

          <Button type="submit" fullWidth disabled={busy}>
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign In'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Button
          type="button"
          variant="outline"
          fullWidth
          disabled={busy}
          onClick={() => void continueWithGoogle()}
        >
          <GoogleIcon className="h-4 w-4" />
          {googleSubmitting ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link className="font-medium text-coral-700" to={`/candidate/login?next=${encodeURIComponent(nextPath)}`}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <Link
                className="font-medium text-coral-700"
                to={`/candidate/register?next=${encodeURIComponent(nextPath)}`}
              >
                Create Candidate Account
              </Link>
            </>
          )}
        </p>
      </Card>
        </div>
      </div>
    </div>
  )
}
