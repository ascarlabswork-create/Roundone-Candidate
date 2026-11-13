import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button.tsx'
import { FieldLabel, PasswordInput, TextInput } from '../ui/primitives.tsx'
import { candidateDisplayTimezone } from '../../lib/candidateTimezone.ts'
import {
  authErrorMessage,
  parseAuthRateLimitSeconds,
  resendSignupConfirmation,
  sendEmailSignInCode,
  sendPasswordReset,
  signInCandidate,
  signUpCandidate,
  verifyEmailSignInCode,
} from '../../services/auth.ts'
import { maskEmailAddress } from '../../services/authCopy.ts'
import { useSession } from '../../state/session.tsx'
import { EmailOtpInputs } from './EmailOtpInputs.tsx'
import { GoogleContinueButton } from './GoogleContinueButton.tsx'

type LoginStep = 'email' | 'code' | 'password'

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
  const [loginStep, setLoginStep] = useState<LoginStep>('email')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resetWait, setResetWait] = useState(0)

  const busy = submitting || emailBusy || status === 'loading'
  const handleGoogleError = useCallback((message: string) => {
    setError(message || null)
  }, [])

  function startResetWait(seconds: number) {
    setResetWait(seconds)
    const started = Date.now()
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, seconds - Math.ceil((Date.now() - started) / 1000))
      setResetWait(remaining)
      if (remaining <= 0) window.clearInterval(timer)
    }, 1000)
  }

  async function sendCode(targetEmail = email) {
    setError(null)
    setInfo(null)
    if (!targetEmail.trim()) {
      setError('Enter your email first.')
      return false
    }
    setEmailBusy(true)
    try {
      await sendEmailSignInCode(targetEmail)
      setOtpCode('')
      setLoginStep('code')
      setInfo('We sent a 6-digit code to your email. Check inbox and spam.')
      startResetWait(60)
      return true
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : ''
      const wait = parseAuthRateLimitSeconds(raw)
      if (wait) startResetWait(wait)
      setError(authErrorMessage(caught))
      return false
    } finally {
      setEmailBusy(false)
    }
  }

  async function continueWithEmail(event: FormEvent) {
    event.preventDefault()
    await sendCode()
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await verifyEmailSignInCode(email, otpCode)
      await refreshAccount()
      onSuccess?.()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await signInCandidate({ email, password })
      await refreshAccount()
      onSuccess?.()
    } catch (caught) {
      const message = authErrorMessage(caught)
      setError(message)
      if (message.includes('confirm your email')) setNeedsConfirmation(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitRegister(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const result = await signUpCandidate({
        email,
        password,
        fullName,
        timezone: candidateDisplayTimezone(),
      })
      if (result.needsEmailConfirmation) {
        setNeedsConfirmation(true)
        setInfo('We sent a confirmation link to your email. Check your inbox and spam folder, then sign in.')
        return
      }
      await refreshAccount()
      onSuccess?.()
    } catch (caught) {
      const message = authErrorMessage(caught)
      setError(message)
      if (message.includes('confirm your email')) setNeedsConfirmation(true)
    } finally {
      setSubmitting(false)
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

  function modeLinks() {
    if (!showModeLinks) return null
    return (
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
              <button type="button" className="font-medium text-coral-700 hover:underline" onClick={() => onSwitchMode('register')}>
                Create account
              </button>
            ) : (
              <Link className="font-medium text-coral-700" to={`/candidate/register?next=${encodeURIComponent(nextPath)}`}>
                Create account
              </Link>
            )}
          </>
        )}
      </p>
    )
  }

  function googleBlock() {
    return (
      <>
        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <GoogleContinueButton mode={mode} disabled={busy} onSuccess={onSuccess} onError={handleGoogleError} />
      </>
    )
  }

  if (isRegister) {
    return (
      <div>
        <form className="space-y-4" onSubmit={(event) => void submitRegister(event)}>
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
            <FieldLabel htmlFor={`${idPrefix}-password`}>Password</FieldLabel>
            <PasswordInput
              id={`${idPrefix}-password`}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
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
            {submitting ? 'Please wait…' : 'Create account'}
          </Button>
        </form>
        {googleBlock()}
        {modeLinks()}
      </div>
    )
  }

  if (loginStep === 'code') {
    return (
      <div>
        <form className="space-y-4" onSubmit={(event) => void verifyCode(event)}>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-navy-950 sm:text-2xl">
              Enter the code we sent to {maskEmailAddress(email)}
            </h2>
            <p className="mt-2 text-sm text-slate-600">Use the 6-digit code from your email. It expires after a few minutes.</p>
          </div>
          <EmailOtpInputs
            idPrefix={`${idPrefix}-otp`}
            value={otpCode}
            disabled={busy}
            onChange={(next) => {
              setOtpCode(next)
              setError(null)
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={busy || resetWait > 0}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-navy-950 hover:bg-slate-50 disabled:text-slate-400"
            >
              {resetWait > 0 ? `Resend in ${resetWait}s` : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginStep('email')
                setOtpCode('')
                setError(null)
                setInfo(null)
              }}
              className="text-sm font-medium text-coral-700 hover:underline"
            >
              Use a different email
            </button>
          </div>
          {error || sessionError ? <p className="text-sm text-red-700">{error || sessionError}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          <Button type="submit" fullWidth disabled={busy || otpCode.length !== 6}>
            {submitting ? 'Checking…' : 'Next'}
          </Button>
        </form>
        <p className="mt-5 text-center">
          <button
            type="button"
            className="text-sm font-semibold text-navy-950 hover:underline"
            onClick={() => {
              setLoginStep('password')
              setError(null)
              setInfo(null)
            }}
          >
            Log in with a password
          </button>
        </p>
        {googleBlock()}
        {modeLinks()}
      </div>
    )
  }

  if (loginStep === 'password') {
    return (
      <div>
        <form className="space-y-4" onSubmit={(event) => void submitPassword(event)}>
          <div>
            <p className="text-sm text-slate-600">
              Signing in as <span className="font-medium text-navy-950">{email}</span>
            </p>
            <button
              type="button"
              className="mt-1 text-xs font-medium text-coral-700 hover:underline"
              onClick={() => {
                setLoginStep('email')
                setPassword('')
                setError(null)
                setInfo(null)
              }}
            >
              Change email
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor={`${idPrefix}-password`}>Password</FieldLabel>
              <button
                type="button"
                onClick={() => void forgotPassword()}
                disabled={busy || resetWait > 0}
                className="text-xs font-medium text-coral-700 hover:underline disabled:text-slate-400"
              >
                {resetWait > 0 ? `Wait ${resetWait}s` : 'Forgot password?'}
              </button>
            </div>
            <PasswordInput
              id={`${idPrefix}-password`}
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500">
            Accounts created with Google have no password. Use Continue with Google, or Forgot password to set one.
          </p>
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
            {submitting ? 'Please wait…' : 'Sign In'}
          </Button>
        </form>
        <p className="mt-5 text-center">
          <button
            type="button"
            className="text-sm font-semibold text-navy-950 hover:underline"
            onClick={() => void sendCode()}
            disabled={busy || resetWait > 0}
          >
            {resetWait > 0 ? `Send code in ${resetWait}s` : 'Sign in with a code instead'}
          </button>
        </p>
        {googleBlock()}
        {modeLinks()}
      </div>
    )
  }

  return (
    <div>
      <form className="space-y-4" onSubmit={(event) => void continueWithEmail(event)}>
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
        {error || sessionError ? <p className="text-sm text-red-700">{error || sessionError}</p> : null}
        {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
        <Button type="submit" fullWidth disabled={busy}>
          {emailBusy ? 'Sending code…' : 'Continue'}
        </Button>
      </form>
      {googleBlock()}
      {modeLinks()}
    </div>
  )
}
