import { buildDashboardPendingActions, missingProfileItems, pickNextInterview } from './candidateDashboardModel.ts'
import type { CandidateBooking } from './bookingModel.ts'
import type { CandidateInterview } from './interviewSessions.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runCandidateDashboardChecks() {
  expect(missingProfileItems({ targetRole: '', candidateLevel: 'SDE 2', skills: ['React'], interviewType: 'Coding' }).includes('target role'), 'Missing target role is reported')
  expect(missingProfileItems({ targetRole: 'SDE', candidateLevel: 'SDE 2', skills: ['React'], interviewType: 'Coding' }).length === 0, 'Complete profile has no missing items')

  const confirmed = {
    id: '00000000-0000-4000-8000-000000000021',
    status: 'confirmed',
    startsAtUtc: '2026-09-20T10:00:00.000Z',
    endsAtUtc: '2026-09-20T11:00:00.000Z',
    interviewerName: 'Ada',
    serviceName: 'Technical Mock',
    session: { id: 's1', bookingId: '00000000-0000-4000-8000-000000000021', provider: 'stub', startedAt: null, endedAt: null },
    hasFeedback: false,
    hasReview: false,
  } as CandidateInterview

  const completed = {
    ...confirmed,
    id: '00000000-0000-4000-8000-000000000022',
    status: 'completed',
    hasFeedback: true,
    hasReview: false,
    session: { ...confirmed.session!, bookingId: '00000000-0000-4000-8000-000000000022' },
  } as CandidateInterview

  const now = new Date('2026-09-18T10:00:00.000Z')
  expect(pickNextInterview([confirmed], now)?.id === confirmed.id, 'Confirmed future interview is next')
  expect(pickNextInterview([{ ...confirmed, endsAtUtc: '2026-09-17T11:00:00.000Z' }], now) == null, 'Past confirmed interview is not next')
  const live = { ...confirmed, id: '00000000-0000-4000-8000-000000000024', status: 'in_progress' } as CandidateInterview
  expect(pickNextInterview([confirmed, live], now)?.id === live.id, 'In-progress interview is preferred over a later confirmed booking')

  const actions = buildDashboardPendingActions({
    nextInterview: confirmed,
    recentCompleted: [completed],
    pendingPayments: [
      {
        id: '00000000-0000-4000-8000-000000000023',
        status: 'pending_payment',
        holdExpiresAt: '2026-09-18T11:00:00.000Z',
      } as CandidateBooking,
    ],
    now,
  })
  expect(actions.some((item) => item.cta === 'View Feedback'), 'Latest feedback becomes a pending action')
  expect(actions.some((item) => item.cta === 'Review Interviewer'), 'Unreviewed completed interview is actionable')
  expect(actions.some((item) => item.cta === 'Complete payment'), 'Active payment hold is actionable')
  expect(!actions.some((item) => item.href.includes('join=1')), 'Confirmed interview outside join window is not a join action')

  return true
}

runCandidateDashboardChecks()
console.log('candidate dashboard checks passed')
