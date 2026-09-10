import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getBooking, getFeedback, getInterviewer, submitReview } from '../api/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card, ErrorState, FieldLabel, Skeleton, TextArea } from '../components/ui/primitives.tsx'
import { InteractiveStars } from '../components/ui/identity.tsx'
import { useAsync } from '../lib/useAsync.ts'
import { useSession } from '../state/session.tsx'
import { useToast } from '../state/toast.tsx'
import type { Readiness } from '../types.ts'

const readinessTone: Record<Readiness, string> = {
  Ready: 'bg-emerald-50 text-emerald-800',
  'Almost Ready': 'bg-amber-50 text-amber-800',
  'Needs More Practice': 'bg-slate-100 text-slate-700',
}

export function FeedbackPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const candidate = useSession()
  const { pushToast } = useToast()
  const bookingState = useAsync(() => getBooking(id), [id])
  const feedbackState = useAsync(() => getFeedback(id), [id])
  const interviewerId = bookingState.status === 'success' ? bookingState.data.interviewerId : ''
  const interviewerState = useAsync(
    () => (interviewerId ? getInterviewer(interviewerId) : Promise.reject(new Error('Missing'))),
    [interviewerId],
  )

  const [stars, setStars] = useState(5)
  const [dims, setDims] = useState({
    technicalExpertise: 5,
    communication: 5,
    interviewRealism: 5,
    feedbackQuality: 5,
    professionalism: 5,
  })
  const [text, setText] = useState('')
  const [recommend, setRecommend] = useState<'yes' | 'maybe' | 'no'>('yes')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!interviewerId || bookingState.status !== 'success') return
    setSubmitting(true)
    try {
      await submitReview({
        interviewerId,
        candidateName: candidate.name,
        rating: stars,
        interviewType: bookingState.data.interviewType,
        text,
        recommend,
        dimensions: dims,
      })
      pushToast('Review submitted. Thank you.')
      navigate('/candidate/progress')
    } finally {
      setSubmitting(false)
    }
  }

  if (bookingState.status === 'loading' || feedbackState.status === 'loading') {
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

  const report = feedbackState.data
  const interviewerName =
    interviewerState.status === 'success' ? interviewerState.data.name : 'your interviewer'
  const scores = report
    ? ([
        ['Technical Skills', report.scores.technicalSkills],
        ['Problem Solving', report.scores.problemSolving],
        ['Communication', report.scores.communication],
        ['System Design', report.scores.systemDesign],
        ['Overall', report.scores.overall],
      ] as const)
    : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-navy-950">Your Interview Feedback</h1>
      <p className="mt-2 text-sm text-slate-600">
        {report
          ? `Scorecard from ${interviewerName} for your ${bookingState.data.interviewType} session.`
          : `Rate ${interviewerName} while the interviewer scorecard is still being prepared.`}
      </p>

      {report ? (
      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-950">Interviewer scorecard</h2>
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
          <h3 className="text-sm font-semibold text-navy-950">Overall Feedback</h3>
          <p className="mt-2 text-sm leading-7 text-slate-700">{report.overallFeedback}</p>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Readiness: <span className="font-semibold text-navy-950">{report.readiness}</span>
        </p>
      </Card>
      ) : (
        <Card className="mt-8 p-6">
          <h2 className="text-lg font-semibold text-navy-950">Interviewer scorecard</h2>
          <p className="mt-2 text-sm text-slate-600">
            Structured feedback appears here after the interviewer submits a scorecard. You can still rate this session below.
          </p>
        </Card>
      )}

      <form onSubmit={onSubmit} className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-navy-950">Rate Your Interviewer</h2>
        <p className="mt-1 text-sm text-slate-600">This review is separate from the scorecard above.</p>
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-800">Overall</p>
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
        <div className="mt-6">
          <FieldLabel htmlFor="review">Written Review</FieldLabel>
          <TextArea
            id="review"
            required
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What should the next candidate know?"
          />
        </div>
        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-slate-800">Recommend?</legend>
          <div className="mt-2 flex gap-2">
            {(['yes', 'maybe', 'no'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRecommend(option)}
                className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${
                  recommend === option ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <Button type="submit" className="mt-6" disabled={submitting} fullWidth>
          {submitting ? 'Submitting…' : 'Submit Review'}
        </Button>
      </form>
    </div>
  )
}
