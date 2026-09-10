import { Link } from 'react-router-dom'
import { listBookings } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { progressSnapshot } from '../data/feedback.ts'
import { formatDateShort } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'

const metrics = [
  ['Coding', progressSnapshot.metrics.coding],
  ['System Design', progressSnapshot.metrics.systemDesign],
  ['Behavioral', progressSnapshot.metrics.behavioral],
  ['Communication', progressSnapshot.metrics.communication],
  ['Problem Solving', progressSnapshot.metrics.problemSolving],
] as const

export function ProgressPage() {
  const bookings = useAsync(() => listBookings(), [])
  const recent = bookings.status === 'success' ? bookings.data.filter((item) => item.status === 'completed') : []

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Your Interview Progress"
        subtitle="Readiness is based on recent mock interviews. Use it to decide what to practice next."
        actions={
          <Link to="/candidate/find">
            <Button>Find Next Interviewer</Button>
          </Link>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="flex flex-col items-center justify-center p-8">
          <p className="text-sm font-medium text-slate-600">Overall readiness</p>
          <p className="mt-2 text-5xl font-semibold text-navy-950">{progressSnapshot.overall}%</p>
          <p className="mt-2 text-sm text-emerald-700">Up from {progressSnapshot.history[0]}%</p>
        </Card>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-navy-950">Metrics</h2>
          <div className="mt-4 space-y-3">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-semibold text-navy-950">{value}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-navy-950">Historical improvement</h2>
        <div className="mt-6 flex items-end gap-4">
          {progressSnapshot.history.map((value, index) => (
            <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-md bg-navy-800" style={{ height: `${value * 1.4}px` }} />
              <span className="text-sm font-semibold text-navy-950">{value}%</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-navy-950">Recent Interviews</h2>
          {bookings.status === 'loading' ? <Skeleton className="mt-4 h-24" /> : null}
          {bookings.status === 'error' ? <ErrorState body={bookings.error} /> : null}
          <ul className="mt-4 space-y-3 text-sm">
            {recent.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span>
                  {item.interviewType} · {formatDateShort(item.start)}
                </span>
                <Link to={`/candidate/feedback/${item.id}`} className="font-medium text-blue-700">
                  View Feedback
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-navy-950">Recent Feedback</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Latest overall score {progressSnapshot.overall}%. System design is the remaining gap vs coding.
          </p>
          <h3 className="mt-6 text-base font-semibold text-navy-950">Recommended Next Interview</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{progressSnapshot.recommendation.body}</p>
          <Link
            to={`/candidate/find?type=${encodeURIComponent(progressSnapshot.recommendation.interviewType)}`}
            className="mt-4 inline-block"
          >
            <Button>Find Next Interviewer</Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
