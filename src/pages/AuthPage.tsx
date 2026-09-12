import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, PageHeader, SelectInput, TextInput } from '../components/ui/primitives.tsx'
import { TIMEZONES } from '../data/catalogs.ts'
import { signInCandidate, signUpCandidate } from '../services/auth.ts'
import { useSession } from '../state/session.tsx'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/candidate/profile'
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
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (status === 'authenticated' && user) {
    return <Navigate to={nextPath} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'register') {
        const result = await signUpCandidate({ email, password, fullName, timezone })
        if (result.needsEmailConfirmation) {
          setInfo('Check your email to confirm your account, then sign in.')
          return
        }
        await refreshAccount()
      } else {
        await signInCandidate({ email, password })
        await refreshAccount()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
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
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <TextInput
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {isRegister ? (
            <div>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <SelectInput
                id="timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </SelectInput>
            </div>
          ) : null}

          {error || sessionError ? <p className="text-sm text-red-700">{error || sessionError}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

          <Button type="submit" fullWidth disabled={submitting || status === 'loading'}>
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link className="font-medium text-blue-700" to={`/candidate/login?next=${encodeURIComponent(nextPath)}`}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to RoundOne?{' '}
              <Link
                className="font-medium text-blue-700"
                to={`/candidate/register?next=${encodeURIComponent(nextPath)}`}
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </Card>
    </div>
  )
}
