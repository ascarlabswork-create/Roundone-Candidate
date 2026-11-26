import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AccountDeletedDialog } from '../components/auth/AccountDeletedDialog.tsx'
import { AuthForm } from '../components/auth/AuthForm.tsx'
import { Card, PageHeader } from '../components/ui/primitives.tsx'
import {
  clearAccountDeleted,
  isAccountDeletedFlag,
} from '../lib/accountDeletedBanner.ts'
import { postAuthPath } from '../lib/postAuthPath.ts'
import { supabase } from '../lib/supabase.ts'
import { useSession } from '../state/session.tsx'

function isStaleDeletedSessionError(message: string | null) {
  if (!message) return false
  const lower = message.toLowerCase()
  return lower.includes('sub claim') || lower.includes('does not exist')
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, user, error: sessionError, signOut } = useSession()
  const [params, setParams] = useSearchParams()
  const nextPath = postAuthPath(params.get('next'))
  const isRegister = mode === 'register'
  const deletedFlag = !isRegister && isAccountDeletedFlag(params.get('deleted'))
  const [showDeletedDialog, setShowDeletedDialog] = useState(deletedFlag)

  useEffect(() => {
    if (!deletedFlag) return
    setShowDeletedDialog(true)
    void (async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // ignore
      }
      try {
        await signOut()
      } catch {
        // ignore — auth user may already be gone
      }
    })()
  }, [deletedFlag, signOut])

  const dismissDeletedDialog = useCallback(() => {
    clearAccountDeleted()
    setShowDeletedDialog(false)
    const next = new URLSearchParams(params)
    next.delete('deleted')
    setParams(next, { replace: true })
  }, [params, setParams])

  if (!deletedFlag && !showDeletedDialog && status === 'authenticated' && user) {
    return <Navigate to={nextPath} replace />
  }

  const visibleSessionError =
    sessionError && !isStaleDeletedSessionError(sessionError) && status !== 'loading' ? sessionError : null

  return (
    <div className="px-4 py-10 sm:px-6 sm:py-16">
      <AccountDeletedDialog open={showDeletedDialog} onContinue={dismissDeletedDialog} />
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          title={isRegister ? 'Create your candidate account' : 'Sign in'}
          subtitle={
            isRegister
              ? 'We’ll use this account for your profile, preferences, and later bookings.'
              : 'Sign in to view and edit your candidate profile.'
          }
        />
        {visibleSessionError ? <p className="mt-4 text-sm text-red-700">{visibleSessionError}</p> : null}
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
