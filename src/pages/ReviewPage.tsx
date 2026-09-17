import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../availability/index.ts'
import { Button } from '../components/ui/Button.tsx'
import { InteractiveStars, StarRating } from '../components/ui/identity.tsx'
import { Card, ErrorState, FieldLabel, Skeleton, TextArea } from '../components/ui/primitives.tsx'
import { cn } from '../lib/cn.ts'
import { useAsync } from '../lib/useAsync.ts'
import {
  REVIEW_ALREADY_SUBMITTED,
  REVIEW_DIMENSIONS,
  RECOMMEND_LABELS,
  RECOMMEND_LEVELS,
  getMyReviewForBooking,
  mapReviewError,
  submitCandidateReview,
  validateReviewInput,
  type CandidateReviewRecord,
  type RecommendLevel,
  type ReviewDimensionKey,
} from '../services/candidateReviews.ts'
import { getCandidateInterviewByBooking, type CandidateInterview } from '../services/interviewSessions.ts'
import { useToast } from '../state/toast.tsx'

type ReviewPageData = {
  interview: CandidateInterview
  review: CandidateReviewRecord | null
}

const DIMENSION_DEFAULTS: Record<ReviewDimensionKey, number> = {
  technicalExpertise: 0,
  communication: 0,
  interviewRealism: 0,
  feedbackQuality: 0,
  professionalism: 0,
}

async function loadReviewPage(bookingId: string): Promise<ReviewPageData> {
  let interview: CandidateInterview
  try {
    interview = await getCandidateInterviewByBooking(bookingId)
  } catch (error) {
    throw mapReviewError(error, 'load')
  }

  if (interview.status !== 'completed') {
    return { interview, review: null }
  }

  try {
    const review = await getMyReviewForBooking(interview.id)
    return { interview, review }
  } catch (error) {
    throw mapReviewError(error, 'load')
  }
}

export function ReviewPage() {
  const { id = '' } = useParams()
  const { pushToast } = useToast()
  const state = useAsync(() => loadReviewPage(id), [id])
  const [overall, setOverall] = useState(0)
  const [dims, setDims] = useState(DIMENSION_DEFAULTS)
  const [recommend, setRecommend] = useState<RecommendLevel | null>(null)
  const [writtenReview, setWrittenReview] = useState('')
  const [showNamePublicly, setShowNamePublicly] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [saved, setSaved] = useState<CandidateReviewRecord | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (state.status !== 'success') return
    if (saved || state.data.review) {
      setFormError(REVIEW_ALREADY_SUBMITTED)
      return
    }
    if (!recommend) {
      setFormError('Please say whether you would recommend this interviewer.')
      return
    }

    const payload = {
      bookingId: state.data.interview.id,
      overallRating: overall,
      technicalExpertise: dims.technicalExpertise,
      communication: dims.communication,
      interviewRealism: dims.interviewRealism,
      feedbackQuality: dims.feedbackQuality,
      professionalism: dims.professionalism,
      recommend,
      writtenReview,
      showNamePublicly,
    }
    const invalid = validateReviewInput(payload)
    if (invalid) {
      setFormError(invalid)
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      const next = await submitCandidateReview(payload)
      setSaved(next)
      setJustSubmitted(true)
      pushToast('Review submitted successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit your review. Please try again.'
      setFormError(message)
      pushToast(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === 'loading' && !saved) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (state.status === 'error' && !saved) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState title="Unable to load review" body={state.error} />
        <div className="mt-4">
          <Link to="/candidate/interviews" className="text-sm font-medium text-blue-700">
            Back to My Interviews
          </Link>
        </div>
      </div>
    )
  }

  if (state.status !== 'success' && !saved) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState body="Unable to load this review." />
      </div>
    )
  }

  const interview = state.status === 'success' ? state.data.interview : null
  const existing = saved ?? (state.status === 'success' ? state.data.review : null)
  const completed = interview?.status === 'completed'
  const canSubmit = Boolean(completed && !existing)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-950">Review Interviewer</h1>
        <p className="mt-2 text-sm text-slate-600">
          Rate this interviewer and the session experience. This is separate from your private interview feedback.
        </p>
      </div>

      {interview ? <InterviewSummary interview={interview} /> : null}

      {justSubmitted ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-800">Review submitted successfully</p>
          <p className="mt-1 text-sm text-emerald-800">
            RoundOne will moderate it before it can appear on the interviewer&apos;s public profile.
          </p>
        </Card>
      ) : null}

      {existing ? <SubmittedReview report={existing} /> : null}

      {interview && !completed ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-navy-950">Review unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">You can review an interviewer after the interview is completed.</p>
          <Link to="/candidate/interviews" className="mt-4 inline-block">
            <Button variant="outline">Back to My Interviews</Button>
          </Link>
        </Card>
      ) : null}

      {canSubmit ? (
        <form className="space-y-6" onSubmit={onSubmit}>
          {formError ? (
            <Card className="border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">{formError}</p>
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-navy-950">Your Rating</h2>
            <p className="mt-1 text-sm text-slate-500">1 to 5 stars for this interviewer.</p>
            <div className="mt-4">
              <InteractiveStars value={overall} onChange={setOverall} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {REVIEW_DIMENSIONS.map((item) => (
                <div key={item.key}>
                  <p className="mb-1 text-sm font-medium text-slate-800">{item.label}</p>
                  <InteractiveStars
                    value={dims[item.key]}
                    onChange={(value) => setDims({ ...dims, [item.key]: value })}
                  />
                </div>
              ))}
            </div>
            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-slate-800">Would you recommend this interviewer?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {RECOMMEND_LEVELS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRecommend(item)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-medium',
                      recommend === item ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {RECOMMEND_LABELS[item]}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-navy-950">Your Review</h2>
            <div className="mt-4">
              <FieldLabel htmlFor="written-review">Written review</FieldLabel>
              <TextArea
                id="written-review"
                required
                className="min-h-40"
                value={writtenReview}
                onChange={(event) => setWrittenReview(event.target.value)}
                placeholder="Share what this session was like for you."
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
                  Unchecked by default. If approved, other candidates see your first name and last initial. Otherwise they
                  see “Anonymous Candidate”. RoundOne sets the public name from your profile.
                </span>
              </span>
            </label>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to="/candidate/interviews">
              <Button type="button" variant="outline" fullWidth className="sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting} className="sm:min-w-44">
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function InterviewSummary({ interview }: { interview: CandidateInterview }) {
  const zone = interview.displayTimezone
  const dateLabel = formatCivilDateWithYear(isoDateInZone(new Date(interview.startsAtUtc), zone))
  return (
    <Card className="grid gap-3 p-5 text-sm sm:grid-cols-2">
      <p>
        <span className="text-slate-500">Interviewer</span>
        <br />
        <span className="font-medium text-navy-950">{interview.interviewerName}</span>
      </p>
      <p>
        <span className="text-slate-500">Interview</span>
        <br />
        <span className="font-medium text-navy-950">
          {interview.serviceName} · {interview.interviewType}
        </span>
      </p>
      <p>
        <span className="text-slate-500">Date</span>
        <br />
        <span className="font-medium text-navy-950">
          {dateLabel} · {formatBookingTime(interview.startsAtUtc, zone)}
        </span>
      </p>
    </Card>
  )
}

function SubmittedReview({ report }: { report: CandidateReviewRecord }) {
  const moderationCopy =
    report.moderationStatus === 'approved'
      ? 'This review is visible on the interviewer’s public profile.'
      : report.moderationStatus === 'rejected'
        ? 'This review was not published.'
        : 'This review is pending RoundOne moderation and is not public yet.'

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <p className="font-semibold text-emerald-800">Review Submitted</p>
        <p className="mt-1 text-sm text-slate-500">{moderationCopy}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StarRating value={report.overallRating} size="md" />
          <span className="text-sm font-medium text-navy-950">{report.overallRating}/5</span>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-700">{report.writtenReview}</p>
        <p className="mt-4 text-xs text-slate-500">
          Public display name: <span className="font-medium text-navy-950">{report.displayName}</span>
        </p>
      </Card>
      <Link to="/candidate/interviews" className="inline-block">
        <Button variant="outline">Back to My Interviews</Button>
      </Link>
    </div>
  )
}
