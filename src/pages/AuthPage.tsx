import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AuthForm } from '../components/auth/AuthForm.tsx'
import { Card, PageHeader } from '../components/ui/primitives.tsx'
import { useSession } from '../state/session.tsx'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/'
  }
  return value
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, user, error: sessionError } = useSession()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const isRegister = mode === 'register'

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
