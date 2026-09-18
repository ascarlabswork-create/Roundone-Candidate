import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { useAsync } from '../lib/useAsync.ts'
import {
  difficultyLabel,
  formatPracticeDate,
  formatPracticeDateShort,
  formatPracticeScore,
  getPracticeProgress,
  listPracticeSessions,
  practiceAgainHref,
  type PracticeProgressSummary,
  type PracticeSessionSummary,
  type PracticeTrendPoint,
} from '../services/practiceProgress.ts'
import { useState } from 'react'

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy-950">{value}</p>
    </Card>
  )
}

function ThemeList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-navy-950">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item}>
              <Badge tone="blue">{item}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function PracticeScoreTrend({ points }: { points: PracticeTrendPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-slate-600">No enough practice history to show a trend yet.</p>
  }

  const width = 640
  const height = 220
  const pad = { top: 16, right: 16, bottom: 36, left: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const minY = 1
  const maxY = 10
  const x = (index: number) => pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW)
  const y = (score: number) => pad.top + ((maxY - score) / (maxY - minY)) * innerH
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.averageScore)}`).join(' ')
  const ticks = [10, 8, 6, 4, 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="AI practice score trend">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-slate-200"
            strokeWidth="1"
          />
          <text x={8} y={y(tick) + 4} className="fill-slate-500 text-[11px]">
            {tick}
          </text>
        </g>
      ))}
      <path d={path} className="stroke-navy-900" fill="none" strokeWidth="2" />
      {points.map((point, index) => (
        <circle key={point.id} cx={x(index)} cy={y(point.averageScore)} r="4.5" className="fill-navy-900" />
      ))}
      {points.map((point, index) => (
        <text key={`${point.id}-label`} x={x(index)} y={height - 12} textAnchor="middle" className="fill-slate-500 text-[11px]">
          {formatPracticeDateShort(point.completedAt)}
        </text>
      ))}
    </svg>
  )
}

function HistoryRow({ session }: { session: PracticeSessionSummary }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-navy-950">{session.targetRole}</p>
          <p className="mt-1 text-sm text-slate-600">
            {session.interviewType} · {difficultyLabel(session.difficulty)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{formatPracticeDate(session.completedAt)}</p>
          <p className="mt-1 text-sm text-slate-600">
            {session.questionsAnswered} of {session.questionCount} questions · Completed
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-lg font-semibold text-navy-950">{formatPracticeScore(session.averageScore)}</p>
          <Link to={`/candidate/practice/history/${session.id}`}>
            <Button size="sm" variant="outline">
              View
            </Button>
          </Link>
        </div>
      </div>
    </li>
  )
}

function SummarySection({
  progress,
  loading,
  error,
  onRetry,
}: {
  progress: PracticeProgressSummary | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-8">
        <ErrorState title="Unable to load practice progress" body={error} onRetry={onRetry} />
      </div>
    )
  }

  if (!progress || progress.sessionCount === 0) return null

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Practice sessions" value={String(progress.sessionCount)} />
        <MetricCard label="Questions answered" value={String(progress.questionsAnswered)} />
        <MetricCard label="Average score" value={formatPracticeScore(progress.averageScore)} />
        <MetricCard label="Highest score" value={formatPracticeScore(progress.highestScore)} />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-navy-950">Score trend</h2>
        <p className="mt-1 text-sm text-slate-600">AI Practice Score over your most recent completed sessions.</p>
        <div className="mt-4">
          <PracticeScoreTrend points={progress.trend} />
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ThemeList
          title="Strong areas"
          items={progress.strengths}
          empty="No recurring strengths yet."
        />
        <ThemeList
          title="Topics to review"
          items={progress.topicsToReview}
          empty="No recurring improvement patterns yet."
        />
      </div>

      {progress.latest ? (
        <Card className="mt-6 p-5">
          <h2 className="font-semibold text-navy-950">Recent practice</h2>
          <p className="mt-2 text-sm font-medium text-navy-950">
            {progress.latest.targetRole} · {progress.latest.interviewType}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatPracticeScore(progress.latest.averageScore)} · {formatPracticeDate(progress.latest.completedAt)}
          </p>
          <Link to={`/candidate/practice/history/${progress.latest.id}`} className="mt-3 inline-block">
            <Button size="sm" variant="outline">
              View
            </Button>
          </Link>
        </Card>
      ) : null}
    </>
  )
}

export function PracticeProgressPage() {
  const [summaryRetry, setSummaryRetry] = useState(0)
  const [historyRetry, setHistoryRetry] = useState(0)
  const summary = useAsync(() => getPracticeProgress(), [summaryRetry])
  const history = useAsync(() => listPracticeSessions(), [historyRetry])
  const latest = summary.status === 'success' ? summary.data.latest : history.status === 'success' ? history.data[0] : null
  const hasSessions =
    (summary.status === 'success' && summary.data.sessionCount > 0) ||
    (history.status === 'success' && history.data.length > 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        title="AI Practice Progress"
        subtitle="These scores come from completed AI practice sessions only. They are not official interviewer feedback or a hiring result."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            {latest ? (
              <Link to={practiceAgainHref(latest)}>
                <Button variant="outline">Practice Again</Button>
              </Link>
            ) : null}
            <Link to="/candidate/practice/mock?fresh=1">
              <Button>Start New Practice</Button>
            </Link>
          </div>
        }
      />

      <SummarySection
        progress={summary.status === 'success' ? summary.data : null}
        loading={summary.status === 'loading'}
        error={summary.status === 'error' ? summary.error : null}
        onRetry={() => setSummaryRetry((value) => value + 1)}
      />

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-navy-950">Practice sessions</h2>
        {history.status === 'loading' ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : null}
        {history.status === 'error' ? (
          <div className="mt-4">
            <ErrorState
              title="Unable to load practice history"
              body={history.error}
              onRetry={() => setHistoryRetry((value) => value + 1)}
            />
          </div>
        ) : null}
        {history.status === 'success' && history.data.length === 0 && !hasSessions ? (
          <div className="mt-4">
            <EmptyState
              title="You haven't completed an AI practice session yet."
              body="Start a practice interview to see scores, feedback, and progress here."
              action={
                <Link to="/candidate/practice/mock">
                  <Button>Start Practice</Button>
                </Link>
              }
            />
          </div>
        ) : null}
        {history.status === 'success' && history.data.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {history.data.map((session) => (
              <HistoryRow key={session.id} session={session} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
