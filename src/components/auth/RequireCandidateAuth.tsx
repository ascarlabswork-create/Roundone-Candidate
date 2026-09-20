import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../state/session.tsx'
import { ErrorState, Skeleton } from '../ui/primitives.tsx'

export function RequireCandidateAuth() {
  const { status, user, error } = useSession()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error && error.includes('only supports candidate')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState title="Candidate account required" body={error} />
      </div>
    )
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/candidate/login?next=${encodeURIComponent(next)}`} replace />
  }

  return <Outlet />
}
