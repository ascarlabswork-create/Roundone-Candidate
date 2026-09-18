import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InterviewSummaryCard } from '../components/interviews/InterviewSummaryCard.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import {
  getCandidateInterviewSessions,
  groupInterviewHistory,
} from '../services/interviewSessions.ts'

type InterviewTab = 'all' | 'upcoming' | 'completed' | 'cancelled'

const tabs: Array<{ id: InterviewTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function emptyCopy(tab: InterviewTab) {
  if (tab === 'upcoming') {
    return {
      title: 'No upcoming interviews',
      body: 'When an interviewer confirms a booking, it will show up here.',
    }
  }
  if (tab === 'completed') {
    return {
      title: 'No completed interviews yet',
      body: 'Finished interviews and their feedback will appear here.',
    }
  }
  if (tab === 'cancelled') {
    return {
      title: 'No cancelled interviews',
      body: 'Cancelled, declined, expired, and rescheduled bookings will appear here.',
    }
  }
  return {
    title: 'Your interviews will appear here.',
    body: 'Book a mock interview to start building your history.',
  }
}

export function InterviewsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<InterviewTab>('upcoming')
  const [retryNonce, setRetryNonce] = useState(0)
  const state = useAsync(() => getCandidateInterviewSessions(), [retryNonce])

  const grouped = useMemo(() => {
    const interviews = state.status === 'success' ? state.data : []
    return groupInterviewHistory(interviews)
  }, [state])

  const visible = useMemo(() => {
    if (tab === 'upcoming') return grouped.upcoming
    if (tab === 'completed') return grouped.completed
    if (tab === 'cancelled') return grouped.cancelled
    return [...grouped.upcoming, ...grouped.completed, ...grouped.cancelled]
  }, [grouped, tab])

  const totalCount = grouped.upcoming.length + grouped.completed.length + grouped.cancelled.length
  const summary = {
    upcoming: grouped.upcoming.length,
    completed: grouped.completed.length,
    feedback: grouped.completed.filter((item) => item.hasFeedback).length,
    reviews: (state.status === 'success' ? state.data : []).filter((item) => item.hasReview).length,
  }

  const empty = emptyCopy(tab)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        title="My Interviews"
        subtitle="Your booking history, upcoming sessions, feedback, and reviews."
        actions={
          <Button variant="outline" onClick={() => navigate('/candidate/find')}>
            Find Interviewer
          </Button>
        }
      />

      {state.status === 'success' && totalCount > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Upcoming</p>
            <p className="mt-1 text-2xl font-semibold text-navy-950">{summary.upcoming}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-navy-950">{summary.completed}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Feedback received</p>
            <p className="mt-1 text-2xl font-semibold text-navy-950">{summary.feedback}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Reviews submitted</p>
            <p className="mt-1 text-2xl font-semibold text-navy-950">{summary.reviews}</p>
          </Card>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
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
            <Skeleton className="h-28" />
          </>
        ) : null}
        {state.status === 'error' ? (
          <ErrorState
            title="Unable to load your interviews"
            body={state.error}
            onRetry={() => setRetryNonce((value) => value + 1)}
          />
        ) : null}
        {state.status === 'success' && !visible.length ? (
          <EmptyState
            title={empty.title}
            body={empty.body}
            action={<Button onClick={() => navigate('/candidate/find')}>Find My Interviewer</Button>}
          />
        ) : null}
        {state.status === 'success'
          ? visible.map((interview) => <InterviewSummaryCard key={interview.id} interview={interview} />)
          : null}
      </div>
    </div>
  )
}
