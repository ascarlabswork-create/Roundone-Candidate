import { isHoldExpired, type CandidateBooking } from './bookingModel.ts'
import { candidateFeedbackAction } from './candidateFeedbackModel.ts'
import { candidateReviewAction } from './candidateReviewModel.ts'
import { canJoinInterview } from './interviewSessionModel.ts'
import type { CandidateInterview } from './interviewSessions.ts'

export const DASHBOARD_RECENT_LIMIT = 3
export const UPCOMING_STATUSES = ['requested', 'confirmed', 'in_progress'] as const
export const NEXT_INTERVIEW_STATUSES = ['confirmed', 'in_progress'] as const

export type DashboardPendingAction = {
  id: string
  title: string
  body: string
  href: string
  cta: string
}

export type CandidateDashboardCounts = {
  completed: number | null
  upcoming: number | null
  feedbackReceived: number | null
  reviewsSubmitted: number | null
}

export type CandidateDashboard = {
  counts: CandidateDashboardCounts
  nextInterview: CandidateInterview | null
  recentCompleted: CandidateInterview[]
  pendingActions: DashboardPendingAction[]
  missingProfileItems: string[]
}

export function missingProfileItems(input: {
  targetRole: string | null | undefined
  candidateLevel: string | null | undefined
  skills: string[]
  interviewType: string | null | undefined
}) {
  const missing: string[] = []
  if (!input.targetRole?.trim()) missing.push('target role')
  if (!input.candidateLevel?.trim()) missing.push('experience level')
  if (input.skills.length === 0) missing.push('skills')
  if (!input.interviewType?.trim()) missing.push('interview preference')
  return missing
}

export function pickNextInterview(interviews: CandidateInterview[], now = new Date()) {
  const nowMs = now.getTime()
  const inProgress = interviews.find((item) => item.status === 'in_progress')
  if (inProgress) return inProgress
  return (
    interviews.find((item) => {
      if (item.status !== 'confirmed') return false
      return new Date(item.endsAtUtc).getTime() >= nowMs
    }) ?? null
  )
}

export function buildDashboardPendingActions(input: {
  nextInterview: CandidateInterview | null
  recentCompleted: CandidateInterview[]
  pendingPayments: CandidateBooking[]
  now?: Date
}): DashboardPendingAction[] {
  const now = input.now ?? new Date()
  const actions: DashboardPendingAction[] = []

  if (input.nextInterview && canJoinInterview(input.nextInterview, input.nextInterview.session, now)) {
    actions.push({
      id: `join-${input.nextInterview.id}`,
      title: 'Interview starting soon',
      body: `${input.nextInterview.serviceName} with ${input.nextInterview.interviewerName}`,
      href: `/candidate/interview/${input.nextInterview.id}?join=1`,
      cta: 'Join Interview',
    })
  }

  for (const booking of input.pendingPayments) {
    if (isHoldExpired(booking, now)) continue
    actions.push({
      id: `pay-${booking.id}`,
      title: 'Payment pending',
      body: 'Finish payment to keep this interview hold.',
      href: `/candidate/booking/confirmation?bookingId=${booking.id}`,
      cta: 'Complete payment',
    })
  }

  const latestFeedback = input.recentCompleted.find((item) => candidateFeedbackAction(item.status, item.hasFeedback) === 'view')
  if (latestFeedback) {
    actions.push({
      id: `feedback-${latestFeedback.id}`,
      title: 'Latest feedback available',
      body: `${latestFeedback.serviceName} with ${latestFeedback.interviewerName}`,
      href: `/candidate/feedback/${latestFeedback.id}`,
      cta: 'View Feedback',
    })
  }

  for (const item of input.recentCompleted) {
    if (candidateReviewAction(item.status, item.hasReview) !== 'rate') continue
    actions.push({
      id: `review-${item.id}`,
      title: 'Review your interviewer',
      body: `${item.serviceName} with ${item.interviewerName}`,
      href: `/candidate/reviews/${item.id}`,
      cta: 'Review Interviewer',
    })
  }

  return actions
}
