import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/primitives.tsx'
import { Button } from '../components/ui/Button.tsx'
import { useSession } from '../state/session.tsx'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/candidate/profile'
  }
  return value
}

/**
 * Handles the Google OAuth redirect. The Supabase client is configured with
 * detectSessionInUrl, so it exchanges the code and fires onAuthStateChange,
 * which the SessionProvider uses to load the candidate profile (and to sign
 * out any interviewer/admin account). This page only reacts to that state.
 */
export function AuthCallbackPage() {
  const { status, account, error } = useSession()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const oauthError = params.get('error_description') ?? params.get('error')
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(id)
  }, [])

  if (status === 'authenticated' && account) {
    return <Navigate to={nextPath} replace />
  }

  const notCandidate = Boolean(error && error.includes('only supports candidate'))
  const failed = Boolean(oauthError) || notCandidate || (timedOut && status !== 'authenticated')

  if (failed) {
    const heading = notCandidate ? 'This account can’t use the Candidate app' : 'Sign-in could not be completed'
    const body = notCandidate
      ? 'This Google account is registered as an interviewer or admin. We’ve signed it out. Use a candidate account to continue.'
      : oauthError
        ? 'Google sign-in was cancelled or failed. Please try again.'
        : 'We couldn’t confirm your session. Please try signing in again.'

    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-navy-950">{heading}</h1>
          <p className="mt-2 text-sm text-slate-600">{body}</p>
          <div className="mt-6 flex justify-center">
            <Link to={`/candidate/login?next=${encodeURIComponent(nextPath)}`}>
              <Button>Back to sign in</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold text-navy-950">Completing sign-in…</h1>
        <p className="mt-2 text-sm text-slate-600">Confirming your candidate account with Google.</p>
      </Card>
    </div>
  )
}
