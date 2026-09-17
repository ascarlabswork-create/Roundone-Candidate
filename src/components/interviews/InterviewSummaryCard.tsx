import { useNavigate } from 'react-router-dom'
import { CandidateFeedbackAction } from './CandidateFeedbackAction.tsx'
import { CandidateReviewAction } from './CandidateReviewAction.tsx'
import { Button } from '../ui/Button.tsx'
import { Badge, Card } from '../ui/primitives.tsx'
import { Avatar } from '../ui/identity.tsx'
import { formatBookingTime, formatCivilDateWithYear, isoDateInZone } from '../../availability/index.ts'
import {
  canJoinInterview,
  canViewInterview,
  interviewStatusLabel,
  type CandidateInterview,
} from '../../services/interviewSessions.ts'

export function InterviewSummaryCard({
  interview,
  compact = false,
}: {
  interview: CandidateInterview
  compact?: boolean
}) {
  const navigate = useNavigate()
  const zone = interview.displayTimezone
  const joinable = canJoinInterview(interview, interview.session)
  const viewable = canViewInterview(interview, interview.session)
  const status = interviewStatusLabel(interview.status)
  const dateLabel = formatCivilDateWithYear(isoDateInZone(new Date(interview.startsAtUtc), zone))

  return (
    <Card className="p-5">
      <div className={`flex flex-col gap-4 ${compact ? '' : 'sm:flex-row sm:items-start sm:justify-between'}`}>
        <div className="flex gap-3">
          <Avatar src={interview.interviewerPhoto ?? ''} name={interview.interviewerName} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-navy-950">{interview.serviceName}</h2>
              <Badge
                tone={
                  interview.status === 'confirmed' || interview.status === 'in_progress'
                    ? 'blue'
                    : interview.status === 'completed'
                      ? 'green'
                      : 'slate'
                }
              >
                {status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {interview.interviewerName}
              {interview.interviewerCompany ? ` · ${interview.interviewerCompany}` : ''}
            </p>
            <p className="mt-1 text-sm text-slate-600">{interview.interviewType}</p>
            <p className="mt-2 text-sm text-navy-950">
              {dateLabel}
              <span className="mt-0.5 block text-slate-600">
                {formatBookingTime(interview.startsAtUtc, zone)} – {formatBookingTime(interview.endsAtUtc, zone)}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {interview.durationMin} min · {zone}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {viewable ? (
            <Button variant="outline" size="sm" onClick={() => navigate(`/candidate/interview/${interview.id}`)}>
              View Interview
            </Button>
          ) : null}
          {joinable ? (
            <Button size="sm" onClick={() => navigate(`/candidate/interview/${interview.id}?join=1`)}>
              Join Interview
            </Button>
          ) : null}
          <CandidateFeedbackAction
            bookingId={interview.id}
            status={interview.status}
            hasFeedback={interview.hasFeedback}
          />
          <CandidateReviewAction
            bookingId={interview.id}
            status={interview.status}
            hasReview={interview.hasReview}
          />
        </div>
      </div>
    </Card>
  )
}
