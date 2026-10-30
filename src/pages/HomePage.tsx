import { CandidateDashboard } from '../components/dashboard/CandidateDashboard.tsx'
import { Skeleton } from '../components/ui/primitives.tsx'
import { PublicHomePage } from './PublicHomePage.tsx'
import { useSession } from '../state/session.tsx'

export function HomePage() {
  const { status, user } = useSession()

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (user) {
    return <CandidateDashboard />
  }

  return <PublicHomePage />
}
