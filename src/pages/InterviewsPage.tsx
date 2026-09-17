import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InterviewSummaryCard } from '../components/interviews/InterviewSummaryCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import { getCandidateInterviewSessions, type CandidateInterview } from '../services/interviewSessions.ts'

type InterviewTab = 'upcoming' | 'completed' | 'cancelled'

const tabs: Array<{ id: InterviewTab; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function tabFor(status: string): InterviewTab | null {
  if (status === 'confirmed' || status === 'in_progress' || status === 'requested') return 'upcoming'
  if (status === 'completed') return 'completed'
  if (status === 'cancelled' || status === 'no_show' || status === 'rejected' || status === 'expired') return 'cancelled'
  return null
}

export function InterviewsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<InterviewTab>('upcoming')
  const state = useAsync(() => getCandidateInterviewSessions(), [])

  const grouped = useMemo(() => {
    const interviews = state.status === 'success' ? state.data : []
    const next: Record<InterviewTab, CandidateInterview[]> = { upcoming: [], completed: [], cancelled: [] }
    for (const interview of interviews) {
      const bucket = tabFor(interview.status)
      if (bucket) next[bucket].push(interview)
    }
    return next
  }, [state])

  const visible = grouped[tab]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-navy-950">My Interviews</h1>
      <p className="mt-2 text-sm text-slate-600">Confirmed sessions use your real bookings. Join when the stub interview is open.</p>

      <div className="mt-6 flex gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === item.id ? 'bg-navy-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {state.status === 'loading' ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : null}
        {state.status === 'error' ? <ErrorState body={state.error} /> : null}
        {state.status === 'success' && !visible.length ? (
          <EmptyState
            title={tab === 'upcoming' ? 'No upcoming interviews' : `No ${tab} interviews`}
            body={
              tab === 'upcoming'
                ? 'When an interviewer confirms a booking, it will show up here.'
                : 'Interviews in this status will appear here.'
            }
            action={
              <Button onClick={() => navigate('/candidate/find')}>Find My Interviewer</Button>
            }
          />
        ) : null}
        {state.status === 'success'
          ? visible.map((interview) => <InterviewSummaryCard key={interview.id} interview={interview} />)
          : null}
      </div>
    </div>
  )
}
