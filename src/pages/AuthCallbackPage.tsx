import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/primitives.tsx'
import { Button } from '../components/ui/Button.tsx'
import { useSession } from '../state/session.tsx'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/'
  }
  return value
}

/**
 * Handles Google OAuth, email confirmation, and password-recovery redirects.
 * The Supabase client is configured with detectSessionInUrl, so it exchanges
 * the code and fires onAuthStateChange. This page only reacts to that state.
 */
export function AuthCallbackPage() {
  const { status, account, error } = useSession()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const oauthError = params.get('error_description') ?? params.get('error')
  const [timedOut, setTimedOut] = useState(false)
  const hashType = typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
  const isRecovery = hashType === 'recovery' || params.get('type') === 'recovery'

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !account) return
    if (!window.opener || window.opener === window) return
    window.close()
  }, [status, account])

  if (status === 'authenticated' && isRecovery) {
    return <Navigate to="/candidate/update-password" replace />
  }

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
        ? 'Sign-in was cancelled or failed. Please try again.'
        : 'We couldn’t confirm your session. Open the latest email link, or try signing in again.'

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
        <p className="mt-2 text-sm text-slate-600">Confirming your candidate account.</p>
      </Card>
    </div>
  )
}
