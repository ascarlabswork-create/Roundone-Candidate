import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button.tsx'
import { FieldLabel, PasswordInput, SelectInput, TextInput } from '../ui/primitives.tsx'
import { GoogleIcon } from '../ui/GoogleIcon.tsx'
import { timezoneSelectOptions } from '../../lib/candidateTimezone.ts'
import {
  authErrorMessage,
  parseAuthRateLimitSeconds,
  resendSignupConfirmation,
  sendPasswordReset,
  signInCandidate,
  signInWithGoogle,
  signUpCandidate,
} from '../../services/auth.ts'
import { useSession } from '../../state/session.tsx'

export function AuthForm({
  mode,
  nextPath,
  idPrefix = 'auth',
  onSuccess,
  onSwitchMode,
  showModeLinks = true,
}: {
  mode: 'login' | 'register'
  nextPath: string
  idPrefix?: string
  onSuccess?: () => void
  onSwitchMode?: (tab: 'login' | 'register') => void
  showModeLinks?: boolean
}) {
  const { status, error: sessionError, refreshAccount } = useSession()
  const isRegister = mode === 'register'
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

  const busy = submitting || googleSubmitting || emailBusy || status === 'loading'

  function startResetWait(seconds: number) {
    setResetWait(seconds)
    const started = Date.now()
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, seconds - Math.ceil((Date.now() - started) / 1000))
      setResetWait(remaining)
      if (remaining <= 0) window.clearInterval(timer)
    }, 1000)
  }

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
      onSuccess?.()
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
    <div>
      <form className="space-y-4" onSubmit={submit}>
        {isRegister ? (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-fullName`}>Full name</FieldLabel>
            <TextInput
              id={`${idPrefix}-fullName`}
              required
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
        ) : null}
        <div>
          <FieldLabel htmlFor={`${idPrefix}-email`}>Email</FieldLabel>
          <TextInput
            id={`${idPrefix}-email`}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor={`${idPrefix}-password`}>Password</FieldLabel>
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
            id={`${idPrefix}-password`}
            required
            minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {isRegister ? (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-confirmPassword`}>Confirm password</FieldLabel>
            <PasswordInput
              id={`${idPrefix}-confirmPassword`}
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
            <FieldLabel htmlFor={`${idPrefix}-timezone`}>Timezone</FieldLabel>
            <SelectInput
              id={`${idPrefix}-timezone`}
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

      <Button type="button" variant="outline" fullWidth disabled={busy} onClick={() => void continueWithGoogle()}>
        <GoogleIcon className="h-4 w-4" />
        {googleSubmitting ? 'Redirecting to Google…' : 'Continue with Google'}
      </Button>

      {showModeLinks ? (
        <p className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? (
            <>
              Already have an account?{' '}
              {onSwitchMode ? (
                <button type="button" className="font-medium text-coral-700 hover:underline" onClick={() => onSwitchMode('login')}>
                  Sign in
                </button>
              ) : (
                <Link className="font-medium text-coral-700" to={`/candidate/login?next=${encodeURIComponent(nextPath)}`}>
                  Sign in
                </Link>
              )}
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              {onSwitchMode ? (
                <button
                  type="button"
                  className="font-medium text-coral-700 hover:underline"
                  onClick={() => onSwitchMode('register')}
                >
                  Create account
                </button>
              ) : (
                <Link
                  className="font-medium text-coral-700"
                  to={`/candidate/register?next=${encodeURIComponent(nextPath)}`}
                >
                  Create account
                </Link>
              )}
            </>
          )}
        </p>
      ) : null}
    </div>
  )
}
