import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getInterviewer, listBookings, listMyReviews } from '../api/index.ts'
import { CompletedSessionCtas } from '../components/interviews/CompletedSessionCtas.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { formatDateShort, formatTime } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import type { Booking, BookingStatus } from '../types.ts'

const tabs: Array<{ id: BookingStatus; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function InterviewsPage() {
  const [tab, setTab] = useState<BookingStatus>('upcoming')
  const state = useAsync(() => listBookings(), [])
  const reviewsState = useAsync(() => listMyReviews(), [])
  const reviewedIds = new Set(
    reviewsState.status === 'success' ? reviewsState.data.map((item) => item.bookingId) : [],
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-navy-950">My Interviews</h1>
      <p className="mt-2 text-sm text-slate-600">Join upcoming sessions or review completed feedback.</p>

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
        {state.status === 'success' ? (
          <BookingList
            bookings={state.data.filter((item) => item.status === tab)}
            tab={tab}
            reviewedIds={reviewedIds}
          />
        ) : null}
      </div>
    </div>
  )
}

function BookingList({
  bookings,
  tab,
  reviewedIds,
}: {
  bookings: Booking[]
  tab: BookingStatus
  reviewedIds: Set<string>
}) {
  if (!bookings.length) {
    return (
      <EmptyState
        title={`No ${tab} interviews`}
        body="When you book a mock interview, it will show up here."
        action={
          <Link to="/candidate/find">
            <Button>Find My Interviewer</Button>
          </Link>
        }
      />
    )
  }

  return (
    <>
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} hasReview={reviewedIds.has(booking.id)} />
      ))}
    </>
  )
}

function BookingCard({ booking, hasReview }: { booking: Booking; hasReview: boolean }) {
  const interviewerState = useAsync(() => getInterviewer(booking.interviewerId), [booking.interviewerId])
  const name = interviewerState.status === 'success' ? interviewerState.data.name : 'Interviewer'
  const completed = booking.status === 'completed'

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-navy-950">{booking.serviceName}</h2>
            <Badge tone={booking.status === 'upcoming' ? 'blue' : completed ? 'green' : 'slate'}>
              {completed ? 'Interview Completed' : booking.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{name}</p>
          <p className="mt-2 text-sm text-slate-600">
            {formatDateShort(booking.start)} · {formatTime(booking.start)} · {booking.durationMin} min
          </p>
          {completed ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="violet">
                {booking.feedbackStatus === 'ready' ? 'Feedback Available' : 'Feedback Pending'}
              </Badge>
              <Badge tone={hasReview ? 'green' : 'blue'}>
                {hasReview ? 'Reviewed' : 'Review Pending'}
              </Badge>
            </div>
          ) : null}
        </div>
        {booking.status === 'upcoming' ? (
          <Link to={`/candidate/interview/${booking.id}`}>
            <Button>Join Interview</Button>
          </Link>
        ) : null}
        {completed ? (
          <CompletedSessionCtas bookingId={booking.id} completed hasReview={hasReview} />
        ) : null}
      </div>
    </Card>
  )
}
