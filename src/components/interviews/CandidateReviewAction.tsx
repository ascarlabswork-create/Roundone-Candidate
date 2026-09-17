import { Link } from 'react-router-dom'
import { candidateReviewAction } from '../../services/candidateReviewModel.ts'
import { Button } from '../ui/Button.tsx'

export function CandidateReviewAction({
  bookingId,
  status,
  hasReview,
  size = 'sm',
}: {
  bookingId: string
  status: string
  hasReview: boolean
  size?: 'sm' | 'md'
}) {
  const action = candidateReviewAction(status, hasReview)
  if (!action) return null

  if (action === 'submitted') {
    return (
      <Link to={`/candidate/reviews/${bookingId}`}>
        <Button size={size} variant="outline">
          Review Submitted
        </Button>
      </Link>
    )
  }

  return (
    <Link to={`/candidate/reviews/${bookingId}`}>
      <Button size={size}>Rate Interviewer</Button>
    </Link>
  )
}
