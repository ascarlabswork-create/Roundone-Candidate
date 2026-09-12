import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card, FieldLabel, PageHeader, TextInput } from '../components/ui/primitives.tsx'
import { authErrorMessage, updatePassword } from '../services/auth.ts'
import { useSession } from '../state/session.tsx'

export function UpdatePasswordPage() {
  const { status } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Your password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await updatePassword(password)
      setDone(true)
      window.setTimeout(() => navigate('/', { replace: true }), 1200)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <PageHeader
        title="Set a new password"
        subtitle="Choose a new password for your candidate account."
      />

      <Card className="mt-8 p-6 sm:p-8">
        {status === 'loading' ? (
          <p className="text-sm text-slate-600">Verifying your reset link…</p>
        ) : status !== 'authenticated' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Open this page from the password reset link we emailed you. If the link expired, request a new one.
            </p>
            <Link to="/candidate/login">
              <Button variant="outline" fullWidth>
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : done ? (
          <p className="text-sm text-emerald-700">Password updated. Redirecting you to the app…</p>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <TextInput
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
              <TextInput
                id="confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
