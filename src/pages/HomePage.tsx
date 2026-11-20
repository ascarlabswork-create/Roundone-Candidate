import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CandidateDashboard } from '../components/dashboard/CandidateDashboard.tsx'
import { Skeleton } from '../components/ui/primitives.tsx'
import { clearIntentReady, markIntentReady } from '../lib/intentReady.ts'
import { CANDIDATE_WELCOME_PATH } from '../lib/postAuthPath.ts'
import { getCandidateProfile, getCandidateSkills } from '../services/candidateProfile.ts'
import { useSession } from '../state/session.tsx'
import { PublicHomePage } from './PublicHomePage.tsx'

export function HomePage() {
  const { status, user } = useSession()
  const [intent, setIntent] = useState<'unknown' | 'ready' | 'needed'>('unknown')

  useEffect(() => {
    if (!user) {
      setIntent('unknown')
      return
    }
    // Always confirm against the DB. Trusting sessionStorage alone flashes the
    // dashboard after delete/re-signin before welcome can open.
    let cancelled = false
    setIntent('unknown')
    void (async () => {
      try {
        const [account, skills] = await Promise.all([getCandidateProfile(), getCandidateSkills()])
        const ready = Boolean(account.candidate.target_role?.trim()) && skills.length > 0
        if (ready) markIntentReady(user.id)
        else clearIntentReady(user.id)
        if (!cancelled) setIntent(ready ? 'ready' : 'needed')
      } catch {
        if (!cancelled) setIntent('needed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (user) {
    if (intent === 'needed') return <Navigate to={CANDIDATE_WELCOME_PATH} replace />
    if (intent !== 'ready') {
      return (
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )
    }
    return <CandidateDashboard />
  }

  return <PublicHomePage />
}
