import { useState } from 'react'
import { Link } from 'react-router-dom'
import { InterviewSummaryCard } from '../interviews/InterviewSummaryCard.tsx'
import { CandidateFeedbackAction } from '../interviews/CandidateFeedbackAction.tsx'
import { CandidateReviewAction } from '../interviews/CandidateReviewAction.tsx'
import { Button } from '../ui/Button.tsx'
import { Card, EmptyState, ErrorState, Skeleton } from '../ui/primitives.tsx'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../../availability/index.ts'
import { useAsync } from '../../lib/useAsync.ts'
import { getCandidateDashboard, type CandidateDashboard } from '../../services/candidateDashboard.ts'
import { interviewStatusLabel } from '../../services/interviewSessions.ts'
import { useNotifications } from '../../state/notifications.tsx'
import { useSession } from '../../state/session.tsx'

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy-950">{value == null ? '—' : value}</p>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}

function ProfilePrompt({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-navy-950">Complete your profile</h2>
      <p className="mt-1 text-sm text-slate-600">Add {missing.join(', ')} so matches can use your real preferences.</p>
      <Link to="/candidate/profile" className="mt-3 inline-block">
        <Button size="sm">Complete your profile</Button>
      </Link>
    </Card>
  )
}

function RecentInterviewRow({ dashboard }: { dashboard: CandidateDashboard }) {
  if (dashboard.recentCompleted.length === 0) {
    return (
      <EmptyState title="You haven't completed an interview yet." body="Finished interviews and feedback will show up here." />
    )
  }

  return (
    <ul className="space-y-3">
      {dashboard.recentCompleted.map((item) => {
        const zone = item.displayTimezone
        return (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-navy-950">{item.serviceName}</p>
                <p className="mt-1 text-sm text-slate-600">{item.interviewerName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatCivilDateWithYear(isoDateInZone(new Date(item.startsAtUtc), zone))} · {formatBookingTime(item.startsAtUtc, zone)}
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
  )
}

export function CandidateDashboard() {
  const { account } = useSession()
  const { unreadCount } = useNotifications()
  const [retryNonce, setRetryNonce] = useState(0)
  const state = useAsync(() => getCandidateDashboard(), [account?.userId, retryNonce])
  const unreadBadge = unreadCount != null && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null

  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy-950 sm:text-3xl">
            {account?.profile.full_name ? `Welcome back, ${account.profile.full_name}` : 'Your RoundOne overview'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">Your next interview, progress, and anything that needs attention.</p>
        </div>

        {state.status === 'loading' ? <DashboardSkeleton /> : null}
        {state.status === 'error' ? (
          <ErrorState title="Unable to load your dashboard" body={state.error} onRetry={() => setRetryNonce((value) => value + 1)} />
        ) : null}

        {state.status === 'success' ? (
          <>
            {state.data.pendingActions.length > 0 ? (
              <Card className="p-5">
                <h2 className="font-semibold text-navy-950">Needs attention</h2>
                <ul className="mt-3 space-y-3">
                  {state.data.pendingActions.map((action) => (
                    <li key={action.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-navy-950">{action.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{action.body}</p>
                      </div>
                      <Link to={action.href}>
                        <Button size="sm">{action.cta}</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <div>
              <h2 className="text-lg font-semibold text-navy-950">Upcoming Interview</h2>
              <div className="mt-3">
                {state.data.nextInterview ? (
                  <InterviewSummaryCard interview={state.data.nextInterview} />
                ) : (
                  <EmptyState
                    title="No upcoming interviews"
                    body="Book a mock interview to see it here."
                    action={
                      <Link to="/candidate/find">
                        <Button>Find an Interviewer</Button>
                      </Link>
                    }
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Interviews completed" value={state.data.counts.completed} />
              <Metric label="Upcoming interviews" value={state.data.counts.upcoming} />
              <Metric label="Feedback received" value={state.data.counts.feedbackReceived} />
              <Metric label="Reviews submitted" value={state.data.counts.reviewsSubmitted} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-navy-950">Recent Interviews</h2>
                  <Link to="/candidate/interviews" className="text-sm font-medium text-blue-700">
                    View All Interviews
                  </Link>
                </div>
                <div className="mt-4">
                  <RecentInterviewRow dashboard={state.data} />
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold text-navy-950">Feedback & reviews</h2>
                {state.data.counts.feedbackReceived == null ? (
                  <p className="mt-2 text-sm text-slate-600">Feedback summary is unavailable right now.</p>
                ) : state.data.counts.feedbackReceived > 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Feedback received on {state.data.counts.feedbackReceived} interview
                    {state.data.counts.feedbackReceived === 1 ? '' : 's'}.
                    {state.data.recentCompleted.some((item) => item.hasFeedback) ? ' Latest feedback is available.' : ''}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No feedback available yet.</p>
                )}
                <p className="mt-3 text-sm text-slate-600">
                  Reviews submitted:{' '}
                  {state.data.counts.reviewsSubmitted == null ? 'unavailable' : state.data.counts.reviewsSubmitted}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/candidate/find">
                    <Button size="sm">Find an Interviewer</Button>
                  </Link>
                  <Link to="/candidate/interviews">
                    <Button size="sm" variant="outline">
                      View My Interviews
                    </Button>
                  </Link>
                  <Link to="/candidate/notifications">
                    <Button size="sm" variant="outline">
                      View Notifications
                      {unreadBadge ? ` (${unreadBadge})` : ''}
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>

            <ProfilePrompt missing={state.data.missingProfileItems} />
          </>
        ) : null}
      </div>
    </section>
  )
}
