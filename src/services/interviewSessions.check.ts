import {
  canJoinInterview,
  canViewInterview,
  groupInterviewHistory,
  interviewHistorySection,
  interviewJoinState,
  interviewStatusLabel,
  isCandidateUpcomingInterview,
  parseInterviewSession,
} from './interviewSessionModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runInterviewSessionChecks() {
  const session = parseInterviewSession({
    id: '00000000-0000-4000-8000-000000000041',
    booking_id: '00000000-0000-4000-8000-000000000021',
    provider: 'stub',
    started_at: null,
    ended_at: null,
    join_token_hash: 'secret-hash',
  })
  expect(Boolean(session), 'Session row must parse')
  expect(session?.provider === 'stub', 'Provider is stub')
  expect(!('joinTokenHash' in (session ?? {})), 'join_token_hash must not be exposed')

  const now = new Date('2026-09-17T13:00:00.000Z')
  const confirmed = {
    status: 'confirmed',
    startsAtUtc: '2026-09-17T13:10:00.000Z',
    endsAtUtc: '2026-09-17T14:10:00.000Z',
  }
  expect(interviewJoinState(confirmed, session, now) === 'lobby', 'C: 10 minutes early opens the LiveKit lobby')
  expect(canJoinInterview(confirmed, session, now), 'C: 10 minutes early can join the same LiveKit room')
  expect(
    interviewJoinState(
      { ...confirmed, startsAtUtc: '2026-09-17T13:20:00.000Z', endsAtUtc: '2026-09-17T14:20:00.000Z' },
      session,
      now,
    ) === 'upcoming',
    'C: 20 minutes early is still waiting',
  )
  expect(
    !canJoinInterview(
      { ...confirmed, startsAtUtc: '2026-09-17T13:20:00.000Z', endsAtUtc: '2026-09-17T14:20:00.000Z' },
      session,
      now,
    ),
    'C: 20 minutes early cannot join LiveKit',
  )
  expect(
    canJoinInterview(
      { ...confirmed, startsAtUtc: '2026-09-17T13:00:00.000Z', endsAtUtc: '2026-09-17T13:30:00.000Z' },
      session,
      now,
    ),
    'C: the call is joinable at the scheduled start',
  )
  expect(
    canJoinInterview(
      { ...confirmed, startsAtUtc: '2026-09-17T12:50:00.000Z', endsAtUtc: '2026-09-17T13:20:00.000Z' },
      session,
      now,
    ),
    'C: a candidate can still join 10 minutes late',
  )
  expect(
    interviewJoinState(
      { ...confirmed, startsAtUtc: '2026-09-17T12:40:00.000Z', endsAtUtc: '2026-09-17T13:10:00.000Z' },
      session,
      now,
    ) === 'closed',
    'C: a new join closes 15 minutes after the start',
  )
  expect(
    !canJoinInterview(
      { ...confirmed, startsAtUtc: '2026-09-17T14:00:00.000Z', endsAtUtc: '2026-09-17T15:00:00.000Z' },
      session,
      now,
    ),
    'Confirmed session too far in the future is not joinable yet',
  )
  expect(
    !canJoinInterview({ status: 'completed', startsAtUtc: confirmed.startsAtUtc, endsAtUtc: confirmed.endsAtUtc }, session, now),
    'G: completed interviews cannot be joined',
  )
  expect(
    !canJoinInterview({ status: 'cancelled', startsAtUtc: confirmed.startsAtUtc, endsAtUtc: confirmed.endsAtUtc }, session, now),
    'H: cancelled interviews cannot be joined',
  )
  expect(
    interviewJoinState({ status: 'no_show', startsAtUtc: confirmed.startsAtUtc, endsAtUtc: confirmed.endsAtUtc }, session, now) ===
      'no_show',
    'No-show uses the no_show state',
  )
  expect(interviewStatusLabel('confirmed') === 'Confirmed', 'Confirmed label')
  expect(interviewStatusLabel('completed') === 'Interview Completed', 'Completed label')
  expect(canViewInterview({ status: 'confirmed' }, session), 'Confirmed bookings with a session can be viewed')
  expect(!canViewInterview({ status: 'confirmed' }, null), 'Confirmed booking without a session has nothing to join')
  expect(!canJoinInterview(confirmed, null, now), 'Join requires an existing session row')
  expect(interviewHistorySection('confirmed') === 'upcoming', 'Confirmed bookings are upcoming')
  expect(interviewHistorySection('requested') === 'upcoming', 'Requested bookings stay in upcoming until confirmed')
  expect(interviewHistorySection('completed') === 'completed', 'Completed bookings are completed')
  expect(interviewHistorySection('rescheduled') === 'cancelled', 'Retired rescheduled bookings are not upcoming')
  expect(interviewHistorySection('cancelled') === 'cancelled', 'Cancelled bookings use the cancelled section')
  expect(interviewStatusLabel('rescheduled') === 'Rescheduled', 'Rescheduled uses a candidate-facing label')

  const grouped = groupInterviewHistory([
    { status: 'completed', startsAtUtc: '2026-09-10T13:00:00.000Z' },
    { status: 'confirmed', startsAtUtc: '2026-09-20T13:00:00.000Z' },
    { status: 'rescheduled', startsAtUtc: '2026-09-12T13:00:00.000Z' },
    { status: 'confirmed', startsAtUtc: '2026-09-18T13:00:00.000Z' },
    { status: 'completed', startsAtUtc: '2026-09-14T13:00:00.000Z' },
  ])
  expect(grouped.upcoming[0]?.startsAtUtc === '2026-09-18T13:00:00.000Z', 'Upcoming sorts nearest first')
  expect(grouped.completed[0]?.startsAtUtc === '2026-09-14T13:00:00.000Z', 'Completed sorts most recent first')
  expect(grouped.cancelled.length === 1 && grouped.cancelled[0]?.status === 'rescheduled', 'Rescheduled stays out of upcoming')

  const requested = {
    status: 'requested',
    endsAtUtc: '2026-09-20T11:00:00.000Z',
  }
  expect(
    isCandidateUpcomingInterview(requested, null, now),
    'Requested bookings stay visible without an interview session',
  )
  expect(
    !isCandidateUpcomingInterview({ status: 'requested', endsAtUtc: '2026-09-16T11:00:00.000Z' }, null, now),
    'A requested booking that already ended is not upcoming',
  )
  expect(
    !isCandidateUpcomingInterview(
      { status: 'confirmed', endsAtUtc: confirmed.endsAtUtc },
      null,
      now,
    ),
    'Confirmed bookings still need a session before they count as upcoming',
  )
  expect(
    isCandidateUpcomingInterview({ status: 'confirmed', endsAtUtc: confirmed.endsAtUtc }, session, now),
    'Confirmed bookings with a session stay upcoming',
  )

  return true
}

runInterviewSessionChecks()
console.log('interview session checks passed')
