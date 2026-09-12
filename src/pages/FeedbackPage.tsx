import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  getBooking,
  getBookingReview,
  getFeedback,
  getInterviewer,
  submitReview,
} from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, FieldLabel, Skeleton, TextArea } from '../components/ui/primitives.tsx'
import { InteractiveStars } from '../components/ui/identity.tsx'
import { interviewSpecificSkill } from '../lib/interviewSkills.ts'
import { useAsync } from '../lib/useAsync.ts'
import { useToast } from '../state/toast.tsx'
import type { Readiness, ReviewRecommend } from '../types.ts'

const readinessTone: Record<Readiness, string> = {
  Ready: 'bg-emerald-50 text-emerald-800',
  'Almost Ready': 'bg-amber-50 text-amber-800',
  'Needs More Practice': 'bg-slate-100 text-slate-700',
}

const recommendOptions: Array<{ id: ReviewRecommend; label: string }> = [
  { id: 'yes', label: 'Yes' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'no', label: 'No' },
]

export function FeedbackPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { pushToast } = useToast()
  const bookingState = useAsync(() => getBooking(id), [id])
  const feedbackState = useAsync(() => getFeedback(id), [id])
  const myReviewState = useAsync(() => getBookingReview(id), [id])
  const interviewerId = bookingState.status === 'success' ? bookingState.data.interviewerId : ''
  const interviewerState = useAsync(
    () => (interviewerId ? getInterviewer(interviewerId) : Promise.reject(new Error('Missing'))),
    [interviewerId],
  )

  const existingReview = myReviewState.status === 'success' ? myReviewState.data : null
  const [submitted, setSubmitted] = useState(false)
  const [stars, setStars] = useState(5)
  const [dims, setDims] = useState({
    technicalExpertise: 5,
    communication: 5,
    interviewRealism: 5,
    feedbackQuality: 5,
    professionalism: 5,
  })
  const [text, setText] = useState('')
  const [recommend, setRecommend] = useState<ReviewRecommend>('yes')
  const [showNamePublicly, setShowNamePublicly] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const reviewLocked = Boolean(existingReview) || submitted

  useEffect(() => {
    if (location.hash !== '#rate') return
    document.getElementById('rate')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, bookingState.status, feedbackState.status])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (bookingState.status !== 'success' || reviewLocked) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitReview(bookingState.data.id, {
        overallRating: stars,
        dimensions: dims,
        writtenReview: text,
        recommend,
        showNamePublicly,
      })
      setSubmitted(true)
      pushToast('Your review has been submitted.')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (
    bookingState.status === 'loading' ||
    feedbackState.status === 'loading' ||
    myReviewState.status === 'loading'
  ) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (bookingState.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState body={bookingState.error} />
        <div className="mt-4">
          <Link to="/candidate/interviews" className="text-sm font-medium text-blue-700">
            Back to My Interviews
          </Link>
        </div>
      </div>
    )
  }

  if (bookingState.status !== 'success' || feedbackState.status !== 'success') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState body="Could not load this session." />
      </div>
    )
  }

  const booking = bookingState.data
  const report = feedbackState.data
  const interviewerName =
    interviewerState.status === 'success' ? interviewerState.data.name : 'your interviewer'
  const specific = interviewSpecificSkill(booking.interviewType)
  const canReview = booking.status === 'completed' && !reviewLocked

  const scores = report
    ? ([
        ['Technical Skills', report.scores.technicalSkills],
        ['Problem Solving', report.scores.problemSolving],
        ['Communication', report.scores.communication],
        [specific.label, report.scores[specific.key]],
        ['Overall score', report.scores.overall],
      ] as const)
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm font-medium text-blue-700">
          {booking.serviceName} · {interviewerName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Session recap</h1>
        <p className="mt-2 text-sm text-slate-600">
          Private interview feedback stays on this page. Public reviews of the interviewer are separate.
        </p>
      </div>

      <section>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Private feedback for you
          </p>
          <h2 className="mt-1 text-xl font-semibold text-navy-950">Your Interview Feedback</h2>
          <p className="mt-1 text-sm text-slate-600">
            This feedback is visible only to you and authorized RoundOne staff.
          </p>
        </div>

        {report ? (
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-600">Overall Performance</p>
                <p className="mt-1 text-3xl font-semibold text-navy-950">{report.scores.overall}%</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${readinessTone[report.readiness]}`}>
                {report.readiness}
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {scores.map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-700">{label}</span>
                    <span className="font-semibold text-navy-950">{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-navy-800" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-navy-950">Strengths</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {report.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-navy-950">Areas to Improve</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {report.improvements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-navy-950">Detailed Feedback</h3>
              <p className="mt-2 text-sm leading-7 text-slate-700">{report.detailedFeedback}</p>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-navy-950">Interview Readiness</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['Ready', 'Almost Ready', 'Needs More Practice'] as const).map((level) => (
                  <span
                    key={level}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      report.readiness === level
                        ? readinessTone[level]
                        : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    {level}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-navy-950">Waiting on your interviewer</h3>
            <p className="mt-2 text-sm text-slate-600">
              Structured private feedback appears here after the interviewer submits a scorecard. It will not
              appear on any public profile.
            </p>
          </Card>
        )}
      </section>

      <section id="rate">
        <h2 className="text-xl font-semibold text-navy-950">Rate Your Interviewer</h2>
        <p className="mt-1 text-sm text-slate-600">
          This public review is interviewer reputation data. It is not your private scorecard.
        </p>

        {reviewLocked ? (
          <Card className="mt-4 p-6">
            <h3 className="text-lg font-semibold text-navy-950">Your review has been submitted.</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Your review may appear on the interviewer&apos;s public profile after RoundOne&apos;s
              review/moderation rules.
            </p>
            {existingReview ? (
              <p className="mt-3 text-sm text-slate-600">
                Public display name:{' '}
                <span className="font-medium text-navy-950">{existingReview.displayName}</span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Public display name:{' '}
                <span className="font-medium text-navy-950">
                  {showNamePublicly ? 'First name + last initial' : 'Anonymous Candidate'}
                </span>
              </p>
            )}
          </Card>
        ) : !canReview && booking.status !== 'completed' ? (
          <Card className="mt-4 p-6">
            <p className="text-sm text-slate-600">
              You can rate {interviewerName} after this interview is completed.
            </p>
          </Card>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-800">Overall Rating</p>
              <InteractiveStars value={stars} onChange={setStars} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['technicalExpertise', 'Technical Expertise'],
                  ['communication', 'Communication'],
                  ['interviewRealism', 'Interview Realism'],
                  ['feedbackQuality', 'Feedback Quality'],
                  ['professionalism', 'Professionalism'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <p className="mb-1 text-sm font-medium text-slate-800">{label}</p>
                  <InteractiveStars
                    value={dims[key]}
                    onChange={(value) => setDims({ ...dims, [key]: value })}
                  />
                </div>
              ))}
            </div>
            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-slate-800">
                Would you recommend this interviewer?
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {recommendOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRecommend(option.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                      recommend === option.id ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-6">
              <FieldLabel htmlFor="review">Written Review</FieldLabel>
              <TextArea
                id="review"
                required
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Share your experience with other candidates..."
              />
            </div>
            <label className="mt-6 flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-navy-950 focus:ring-blue-600"
                checked={showNamePublicly}
                onChange={(event) => setShowNamePublicly(event.target.checked)}
              />
              <span>
                Show my name publicly
                <span className="mt-1 block text-slate-500">
                  Unchecked by default. If unchecked, other candidates see “Anonymous Candidate”.
                </span>
              </span>
            </label>
            {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}
            <Button type="submit" className="mt-6" disabled={submitting} fullWidth>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
          </form>
        )}
      </section>
    </div>
  )
}
