import { CalendarPlus, CheckCircle2, Video } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBooking, getInterviewer } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, Skeleton } from '../components/ui/primitives.tsx'
import { Avatar } from '../components/ui/identity.tsx'
import { formatDateLong, formatTime } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'

export function ConfirmationPage() {
  const [params] = useSearchParams()
  const bookingId = params.get('bookingId') ?? ''
  const bookingState = useAsync(() => getBooking(bookingId), [bookingId])
  const interviewerId = bookingState.status === 'success' ? bookingState.data.interviewerId : ''
  const interviewerState = useAsync(
    () => (interviewerId ? getInterviewer(interviewerId) : Promise.reject(new Error('Missing interviewer'))),
    [interviewerId],
  )

  if (!bookingId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState body="No booking id was provided." />
      </div>
    )
  }

  if (bookingState.status === 'loading' || interviewerState.status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (bookingState.status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState body={bookingState.error} />
      </div>
    )
  }

  const booking = bookingState.data
  const interviewer = interviewerState.status === 'success' ? interviewerState.data : null

  function addToCalendar() {
    const start = new Date(booking.start)
    const end = new Date(start.getTime() + booking.durationMin * 60 * 1000)
    const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:RoundOne ${booking.serviceName}`,
      `DESCRIPTION:Mock interview with ${interviewer?.name ?? 'your interviewer'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'roundone-interview.ics'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-3xl font-semibold text-navy-950">Booking Confirmed!</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your mock interview is scheduled. A calendar file is ready if you want a reminder.
        </p>
        {interviewer ? (
          <div className="mt-6 flex justify-center">
            <Avatar src={interviewer.photo} name={interviewer.name} size="lg" />
          </div>
        ) : null}
        <dl className="mt-6 grid gap-3 text-left text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Interviewer</dt>
            <dd className="font-medium text-navy-950">{interviewer?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Service</dt>
            <dd className="font-medium text-navy-950">{booking.serviceName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Date</dt>
            <dd className="font-medium text-navy-950">{formatDateLong(booking.start)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Time</dt>
            <dd className="font-medium text-navy-950">{formatTime(booking.start)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Timezone</dt>
            <dd className="font-medium text-navy-950">{booking.timezone}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Meeting mode</dt>
            <dd className="font-medium text-navy-950">{booking.mode}</dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={addToCalendar}>
            <CalendarPlus className="h-4 w-4" />
            Add to Calendar
          </Button>
          <Link to="/candidate/interviews">
            <Button variant="outline" fullWidth>
              View My Interviews
            </Button>
          </Link>
          <Link to={`/candidate/interview/${booking.id}`}>
            <Button fullWidth>
              <Video className="h-4 w-4" />
              Join Interview
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
