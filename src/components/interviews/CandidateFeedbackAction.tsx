import { Link } from 'react-router-dom'
import { candidateFeedbackAction } from '../../services/candidateFeedbackModel.ts'
import { Button } from '../ui/Button.tsx'

export function CandidateFeedbackAction({
  bookingId,
  status,
  hasFeedback,
  size = 'sm',
}: {
  bookingId: string
  status: string
  hasFeedback: boolean
  size?: 'sm' | 'md'
}) {
  const action = candidateFeedbackAction(status, hasFeedback)
  if (!action) return null

  if (action === 'pending') {
    return (
      <span className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-amber-800">
        Feedback Pending
      </span>
    )
  }

  return (
    <Link to={`/candidate/feedback/${bookingId}`}>
      <Button size={size} variant="outline">
        View Feedback
      </Button>
    </Link>
  )
}
