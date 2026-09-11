import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button.tsx'

export function CompletedSessionCtas({
  bookingId,
  completed,
  hasReview,
}: {
  bookingId: string
  completed: boolean
  hasReview: boolean
}) {
  const feedbackTo = `/candidate/feedback/${bookingId}`
  const rateTo = `/candidate/feedback/${bookingId}#rate`

  if (!completed) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="sm" disabled>
          View Feedback
        </Button>
        <Button variant="outline" size="sm" disabled>
          Rate Interviewer
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Link to={feedbackTo}>
        <Button variant="outline" size="sm" fullWidth>
          View Feedback
        </Button>
      </Link>
      {hasReview ? (
        <span className="inline-flex h-9 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium text-emerald-700">
          <Check className="h-4 w-4" aria-hidden="true" />
          Reviewed ✓
        </span>
      ) : (
        <Link to={rateTo}>
          <Button size="sm" fullWidth>
            Rate Interviewer
          </Button>
        </Link>
      )}
    </div>
  )
}
