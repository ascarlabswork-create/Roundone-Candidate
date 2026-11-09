import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AuthForm } from '../components/auth/AuthForm.tsx'
import { Card, PageHeader } from '../components/ui/primitives.tsx'
import { postAuthPath } from '../lib/postAuthPath.ts'
import { useSession } from '../state/session.tsx'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, user, error: sessionError } = useSession()
  const [params] = useSearchParams()
  const nextPath = postAuthPath(params.get('next'))
  const isRegister = mode === 'register'
  const accountDeleted = !isRegister && params.get('deleted') === '1'

  if (status === 'authenticated' && user) {
    return <Navigate to={nextPath} replace />
  }

  return (
    <div className="px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          title={isRegister ? 'Create your candidate account' : 'Sign in'}
          subtitle={
            isRegister
              ? 'We’ll use this account for your profile, preferences, and later bookings.'
              : 'Sign in to view and edit your candidate profile.'
          }
        />
        {accountDeleted ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your candidate account has been deleted. You can create a new account anytime.
          </p>
        ) : null}
        {sessionError && status !== 'loading' ? (
          <p className="mt-4 text-sm text-red-700">{sessionError}</p>
        ) : null}
        <Card className="mt-8 p-6 sm:p-8">
          <AuthForm mode={mode} nextPath={nextPath} idPrefix="page-auth" showModeLinks />
        </Card>
        <p className="mt-6 text-center text-sm text-slate-600">
          <Link to="/" className="font-medium text-coral-700 hover:underline">
            Back to homepage
          </Link>
        </p>
      </div>
    </div>
  )
}
