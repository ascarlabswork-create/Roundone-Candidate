import { ArrowRight, CalendarDays, ClipboardCheck, Sparkles, Target } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
import {
  formatPracticeDate,
  formatPracticeScore,
  getPracticeProgress,
} from '../../services/practiceProgress.ts'
import { useNotifications } from '../../state/notifications.tsx'
import { useSession } from '../../state/session.tsx'

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value == null ? '—' : value}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

function ProfilePrompt({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null

  return (
    <Card className="border-coral-100 bg-coral-50/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Profile</p>
      <h2 className="mt-2 font-semibold text-navy-950">Complete your profile</h2>
      <p className="mt-1 text-sm text-slate-600">Add {missing.join(', ')} so matches can use your real preferences.</p>
      <Link to="/candidate/profile" className="mt-3 inline-block">
        <Button size="sm">Complete your profile</Button>
      </Link>
    </Card>
  )
}

function Shortcut({
  to,
  icon,
  title,
  body,
}: {
  to: string
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-navy-950/8 bg-white/90 p-5 shadow-[0_18px_40px_-28px_rgba(12,18,32,0.45)] transition hover:border-coral-200 hover:shadow-[0_18px_40px_-24px_rgba(210,71,38,0.35)]"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-coral-50 text-coral-700">
        {icon}
      </span>
      <span className="mt-4 flex items-center gap-1 text-base font-semibold text-navy-950">
        {title}
        <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
      </span>
      <span className="mt-1 text-sm leading-6 text-slate-600">{body}</span>
    </Link>
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
          <li key={item.id} className="rounded-2xl border border-navy-950/8 bg-paper p-4">
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

function PracticeDashboardCard({ userId }: { userId: string | undefined }) {
  const [retryNonce, setRetryNonce] = useState(0)
  const state = useAsync(() => getPracticeProgress(), [userId, retryNonce])

  return (
    <Card className="h-full p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Practice log</p>
      <h2 className="mt-2 font-semibold text-navy-950">AI Practice</h2>
      {state.status === 'loading' ? <Skeleton className="mt-3 h-12 w-48" /> : null}
      {state.status === 'error' ? (
        <div className="mt-2">
          <p className="text-sm text-slate-600">Unable to load practice progress.</p>
          <button type="button" className="mt-1 text-sm font-medium text-coral-700" onClick={() => setRetryNonce((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : null}
      {state.status === 'success' && state.data.sessionCount === 0 ? (
        <p className="mt-2 text-sm text-slate-600">You haven&apos;t completed an AI practice session yet.</p>
      ) : null}
      {state.status === 'success' && state.data.sessionCount > 0 ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            {state.data.sessionCount} session{state.data.sessionCount === 1 ? '' : 's'} · Average{' '}
            {formatPracticeScore(state.data.averageScore)}
          </p>
          {state.data.latest ? (
            <div className="mt-3 rounded-2xl bg-paper p-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Recent practice</p>
              <p className="mt-1 text-sm font-medium text-navy-950">
                {state.data.latest.targetRole} · {state.data.latest.interviewType}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {formatPracticeScore(state.data.latest.averageScore)} · {formatPracticeDate(state.data.latest.completedAt)}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/candidate/practice/history">
          <Button size="sm" variant="outline">
            View Progress
          </Button>
        </Link>
        {state.status === 'success' && state.data.latest ? (
          <Link to={`/candidate/practice/history/${state.data.latest.id}`}>
            <Button size="sm" variant="outline">
              View Practice
            </Button>
          </Link>
        ) : null}
      </div>
    </Card>
  )
}

export function CandidateDashboard() {
  const { account } = useSession()
  const { unreadCount } = useNotifications()
  const [retryNonce, setRetryNonce] = useState(0)
  const state = useAsync(() => getCandidateDashboard(), [account?.userId, retryNonce])
  const unreadBadge = unreadCount != null && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null
  const firstName = account?.profile.full_name?.trim().split(/\s+/)[0]

  return (
    <section className="pb-16">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="studio-ink overflow-hidden rounded-[2rem] px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Your studio</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {firstName ? `Welcome back, ${firstName}` : 'Your jobround.ai overview'}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Your next interview, practice score, and anything that needs attention — in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/candidate/find">
                <Button>Find My Interviewer</Button>
              </Link>
              <Link
                to="/candidate/practice/mock?fresh=1"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white transition hover:border-gold-400 hover:text-gold-400"
              >
                Start AI Interview
              </Link>
            </div>
          </div>
          {state.status === 'success' ? (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Interviews completed" value={state.data.counts.completed} />
              <Metric label="Upcoming interviews" value={state.data.counts.upcoming} />
              <Metric label="Feedback received" value={state.data.counts.feedbackReceived} />
              <Metric label="Reviews submitted" value={state.data.counts.reviewsSubmitted} />
            </div>
          ) : null}
        </div>

        {state.status === 'loading' ? <DashboardSkeleton /> : null}
        {state.status === 'error' ? (
          <ErrorState title="Unable to load your dashboard" body={state.error} onRetry={() => setRetryNonce((value) => value + 1)} />
        ) : null}

        {state.status === 'success' ? (
          <>
            {state.data.pendingActions.length > 0 ? (
              <Card className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Needs attention</p>
                <h2 className="mt-2 text-lg font-semibold text-navy-950">Finish these before the next round</h2>
                <ul className="mt-4 space-y-3">
                  {state.data.pendingActions.map((action) => (
                    <li
                      key={action.id}
                      className="flex flex-col gap-3 rounded-2xl border border-navy-950/8 bg-paper p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-navy-950">{action.title}</p>
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

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">Next up</p>
                    <h2 className="mt-1 text-lg font-semibold text-navy-950">Upcoming interview</h2>
                  </div>
                  <Link to="/candidate/interviews" className="text-sm font-semibold text-coral-700">
                    View all
                  </Link>
                </div>
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
              <PracticeDashboardCard userId={account?.userId} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Shortcut
                to="/candidate/find"
                icon={<Target className="h-5 w-5" />}
                title="Find Interviewer"
                body="Match with someone who has run the loop you are practicing."
              />
              <Shortcut
                to="/candidate/practice"
                icon={<Sparkles className="h-5 w-5" />}
                title="AI Practice"
                body="Warm up with generated questions before the live round."
              />
              <Shortcut
                to="/candidate/preparation"
                icon={<ClipboardCheck className="h-5 w-5" />}
                title="AI Prep"
                body="Build a plan from your role, skills, and target company."
              />
              <Shortcut
                to="/candidate/interviews"
                icon={<CalendarDays className="h-5 w-5" />}
                title="My Interviews"
                body="Bookings, scorecards, and reviews in one history."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">History</p>
                    <h2 className="mt-1 font-semibold text-navy-950">Recent interviews</h2>
                  </div>
                  <Link to="/candidate/interviews" className="text-sm font-medium text-coral-700">
                    View all
                  </Link>
                </div>
                <div className="mt-4">
                  <RecentInterviewRow dashboard={state.data} />
                </div>
              </Card>
              <Card className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral-700">After the round</p>
                <h2 className="mt-1 font-semibold text-navy-950">Feedback & reviews</h2>
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
                <div className="mt-5 flex flex-wrap gap-2">
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
