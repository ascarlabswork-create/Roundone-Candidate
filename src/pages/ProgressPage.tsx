import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CandidateFeedbackAction } from '../components/interviews/CandidateFeedbackAction.tsx'
import { CandidateReviewAction } from '../components/interviews/CandidateReviewAction.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../availability/index.ts'
import { useAsync } from '../lib/useAsync.ts'
import { getCandidateDashboard } from '../services/candidateDashboard.ts'
import { interviewStatusLabel } from '../services/interviewSessions.ts'

function metricValue(value: number | null) {
  return value == null ? '—' : value
}

export function ProgressPage() {
  const [retryNonce, setRetryNonce] = useState(0)
  const state = useAsync(() => getCandidateDashboard(), [retryNonce])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Your Interview Progress"
        subtitle="Counts come from your real bookings, feedback, and reviews."
        actions={
          <Link to="/candidate/find">
            <Button>Find Next Interviewer</Button>
          </Link>
        }
      />

      {state.status === 'loading' ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="mt-8">
          <ErrorState title="Unable to load your progress" body={state.error} onRetry={() => setRetryNonce((value) => value + 1)} />
        </div>
      ) : null}

      {state.status === 'success' ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</p>
              <p className="mt-1 text-2xl font-semibold text-navy-950">{metricValue(state.data.counts.completed)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Upcoming</p>
              <p className="mt-1 text-2xl font-semibold text-navy-950">{metricValue(state.data.counts.upcoming)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Feedback received</p>
              <p className="mt-1 text-2xl font-semibold text-navy-950">{metricValue(state.data.counts.feedbackReceived)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Reviews submitted</p>
              <p className="mt-1 text-2xl font-semibold text-navy-950">{metricValue(state.data.counts.reviewsSubmitted)}</p>
            </Card>
          </div>

          <Card className="mt-6 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-navy-950">Recent Interviews</h2>
              <Link to="/candidate/interviews" className="text-sm font-medium text-blue-700">
                View All Interviews
              </Link>
            </div>
            {state.data.recentCompleted.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="You haven't completed an interview yet." body="Completed interviews will appear here." />
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {state.data.recentCompleted.map((item) => {
                  const zone = item.displayTimezone
                  return (
                    <li key={item.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-navy-950">{item.serviceName}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.interviewerName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatCivilDateWithYear(isoDateInZone(new Date(item.startsAtUtc), zone))} ·{' '}
                            {formatBookingTime(item.startsAtUtc, zone)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-emerald-700">{interviewStatusLabel(item.status)}</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                          <CandidateFeedbackAction bookingId={item.id} status={item.status} hasFeedback={item.hasFeedback} />
                          <CandidateReviewAction bookingId={item.id} status={item.status} hasReview={item.hasReview} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
