import { candidateFeedbackAction } from '../services/candidateFeedbackModel.ts'
import { interviewJoinState } from '../services/interviewSessionModel.ts'
import {
  confirmationCallTarget,
  interviewCallHref,
  interviewRoomName,
  interviewTokenGate,
  isLobbyOpen,
  interviewLobbyStatusCopy,
  parseInterviewToken,
  participantIdentity,
  reduceCallPresence,
  remoteLeftLabel,
  roleFromIdentity,
  sameInterviewRoom,
  shouldEnterCall,
  waitingLabel,
} from './callModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const sessionId = '00000000-0000-4000-8000-0000000000aa'
const bookingId = '00000000-0000-4000-8000-0000000000bb'
const candidateUser = '00000000-0000-4000-8000-0000000000c1'
const interviewerUser = '00000000-0000-4000-8000-0000000000c2'
const room = interviewRoomName(sessionId)

expect(room === `roundone-interview-${sessionId}`, 'Room name is derived from the session id')
expect(interviewRoomName(sessionId) === room, 'Candidate and interviewer share the room name')
expect(sameInterviewRoom(sessionId), 'Both sides resolve one room')
expect(participantIdentity('candidate', candidateUser) === `candidate:${candidateUser}`, 'Candidate identity is the auth user')
expect(participantIdentity('interviewer', interviewerUser) === `interviewer:${interviewerUser}`, 'Interviewer identity is the auth user')
expect(participantIdentity('candidate', candidateUser) !== participantIdentity('interviewer', interviewerUser), 'Identities stay distinct')

const now = new Date('2026-09-30T12:00:00.000Z')
const atStart = '2026-09-30T12:00:00.000Z'
const atEnd = '2026-09-30T12:30:00.000Z'
const tenEarly = '2026-09-30T12:10:00.000Z'
const lobbyStart = '2026-09-30T12:20:00.000Z'
const tenLate = '2026-09-30T11:50:00.000Z'
const twentyLate = '2026-09-30T11:40:00.000Z'
const futureStart = '2026-10-01T02:30:00.000Z'
const futureEnd = '2026-10-01T03:30:00.000Z'
const sessionRow = { endedAt: null }

function plusMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

const candidateHref = confirmationCallTarget({
  role: 'candidate',
  previousStatus: 'requested',
  nextStatus: 'confirmed',
  bookingId,
  currentPath: '/candidate/interviews',
  startsAt: atStart,
  now,
})
const interviewerHref = confirmationCallTarget({
  role: 'interviewer',
  previousStatus: 'requested',
  nextStatus: 'confirmed',
  bookingId,
  currentPath: '/interviewer/bookings',
  startsAt: atStart,
  now,
})
expect(candidateHref === interviewCallHref(bookingId, true), 'Confirmation at the scheduled start can open the call')
expect(interviewerHref === interviewCallHref(bookingId, true), 'Interviewer confirmation at the start uses the same call')
expect(candidateHref === interviewerHref, 'Both participants receive the same interview route')
expect(
  confirmationCallTarget({
    role: 'candidate',
    previousStatus: 'requested',
    nextStatus: 'confirmed',
    bookingId,
    currentPath: '/candidate/interviews',
    startsAt: tenEarly,
    now,
  }) === interviewCallHref(bookingId, true),
  '1. Acceptance 10 minutes early can open the same LiveKit room',
)
expect(
  confirmationCallTarget({
    role: 'candidate',
    previousStatus: 'requested',
    nextStatus: 'confirmed',
    bookingId,
    currentPath: '/candidate/interviews',
    startsAt: futureStart,
    now,
  }) == null,
  '1. Acceptance one day early does not start the call',
)
expect(
  confirmationCallTarget({
    role: 'candidate',
    previousStatus: 'requested',
    nextStatus: 'confirmed',
    bookingId,
    currentPath: '/candidate/interviews',
    startsAt: futureStart,
    now,
  }) == null,
  'A future booking confirmation does not open the call',
)
expect(
  confirmationCallTarget({
    role: 'interviewer',
    previousStatus: 'requested',
    nextStatus: 'confirmed',
    bookingId,
    currentPath: '/interviewer/bookings',
    startsAt: futureStart,
    now,
  }) == null,
  'Interviewer confirmation of a future booking does not open the call',
)
expect(
  confirmationCallTarget({
    role: 'candidate',
    previousStatus: 'confirmed',
    nextStatus: 'confirmed',
    bookingId,
    currentPath: '/candidate/interviews',
    startsAt: atStart,
    now,
  }) == null,
  'A repeated confirmation does not navigate again',
)
expect(
  confirmationCallTarget({
    role: 'candidate',
    previousStatus: 'requested',
    nextStatus: 'confirmed',
    bookingId,
    currentPath: `/candidate/interview/${bookingId}`,
    startsAt: atStart,
    now,
  }) == null,
  'Staying on the call does not navigate again',
)

expect(!isLobbyOpen(lobbyStart, now), '2. Twenty minutes before the start the room is still closed')
expect(isLobbyOpen(tenEarly, now), '2. The room is open 10 minutes before the start')
expect(!isLobbyOpen(atStart, now), 'The early-join lobby ends when the interview starts')
expect(
  interviewJoinState({ status: 'confirmed', startsAtUtc: lobbyStart, endsAtUtc: plusMinutes(lobbyStart, 30) }, sessionRow, now) ===
    'upcoming',
  '2. Twenty minutes early is still waiting, not the call',
)
expect(
  interviewJoinState({ status: 'confirmed', startsAtUtc: tenEarly, endsAtUtc: plusMinutes(tenEarly, 30) }, sessionRow, now) ===
    'lobby',
  '2. A candidate can open the room 10 minutes before the start',
)
expect(
  shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: tenEarly,
    endsAt: plusMinutes(tenEarly, 30),
    now,
  }),
  '3. The candidate can enter LiveKit 10 minutes before the start',
)
expect(
  !shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: lobbyStart,
    endsAt: plusMinutes(lobbyStart, 30),
    now,
  }),
  '3. The candidate cannot enter LiveKit 20 minutes before the start',
)
expect(
  interviewTokenGate({
    role: 'candidate',
    status: 'confirmed',
    startsAt: tenEarly,
    endsAt: plusMinutes(tenEarly, 30),
    ended: false,
    now,
  }) === 'ok',
  '3. A token is allowed 10 minutes before the scheduled start',
)
expect(
  interviewTokenGate({
    role: 'candidate',
    status: 'confirmed',
    startsAt: lobbyStart,
    endsAt: plusMinutes(lobbyStart, 30),
    ended: false,
    now,
  }) === 'INTERVIEW_NOT_STARTED',
  '3. A token is refused more than 15 minutes before the scheduled start',
)
expect(
  interviewTokenGate({
    role: 'candidate',
    status: 'confirmed',
    startsAt: atStart,
    endsAt: atEnd,
    ended: false,
    now: new Date(new Date(atStart).getTime() + 15 * 60_000 + 1),
  }) === 'JOIN_WINDOW_CLOSED',
  '10. A direct request after the deadline is refused from the schedule, not the browser clock',
)

expect(
  shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: atStart,
    endsAt: atEnd,
    now,
  }),
  '4. A candidate can join at the scheduled start',
)
expect(
  interviewTokenGate({ role: 'candidate', status: 'confirmed', startsAt: atStart, endsAt: atEnd, ended: false, now }) === 'ok',
  '4. A token is allowed at the scheduled start',
)
expect(
  shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: tenLate,
    endsAt: plusMinutes(tenLate, 30),
    now,
  }),
  '5. A candidate can join 10 minutes late',
)
expect(
  interviewTokenGate({
    role: 'candidate',
    status: 'confirmed',
    startsAt: tenLate,
    endsAt: plusMinutes(tenLate, 30),
    ended: false,
    now,
  }) === 'ok',
  '5. A token is allowed 10 minutes late',
)
expect(
  !shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: twentyLate,
    endsAt: plusMinutes(twentyLate, 30),
    now,
  }),
  '6. A new join is refused after the 15-minute deadline',
)
expect(
  interviewTokenGate({
    role: 'candidate',
    status: 'confirmed',
    startsAt: twentyLate,
    endsAt: plusMinutes(twentyLate, 30),
    ended: false,
    now,
  }) === 'JOIN_WINDOW_CLOSED',
  '6. A token is refused after the late-join deadline',
)
expect(
  interviewJoinState(
    { status: 'confirmed', startsAtUtc: twentyLate, endsAtUtc: plusMinutes(twentyLate, 30) },
    sessionRow,
    now,
  ) === 'closed',
  '6. The page shows the join window as closed',
)
expect(plusMinutes(tenLate, 30) === '2026-09-30T12:20:00.000Z', '7. A 10-minute-late join keeps the original 30-minute end')
expect(
  !shouldEnterCall({
    status: 'in_progress',
    hasSession: true,
    ended: false,
    startsAt: tenLate,
    endsAt: plusMinutes(tenLate, 30),
    now: new Date(plusMinutes(tenLate, 30)),
  }),
  '7. The call stops at the original scheduled end',
)
expect(
  shouldEnterCall({
    status: 'in_progress',
    hasSession: true,
    ended: false,
    startsAt: tenLate,
    endsAt: plusMinutes(tenLate, 30),
    now: new Date('2026-09-30T12:19:00.000Z'),
  }),
  '7. An interview already in progress can continue until the original end',
)
expect(
  !shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: futureStart,
    endsAt: futureEnd,
    now,
  }),
  'A confirmed future session cannot be entered yet',
)
expect(
  shouldEnterCall({
    status: 'in_progress',
    hasSession: true,
    ended: false,
    startsAt: tenEarly,
    endsAt: plusMinutes(tenEarly, 60),
    now,
  }),
  'An in-progress flag inside the early-join window opens LiveKit',
)
expect(
  !shouldEnterCall({
    status: 'in_progress',
    hasSession: true,
    ended: false,
    startsAt: lobbyStart,
    endsAt: plusMinutes(lobbyStart, 60),
    now,
  }),
  'An in-progress flag before the 15-minute window does not open LiveKit',
)
expect(
  !shouldEnterCall({
    status: 'requested',
    hasSession: false,
    ended: false,
    startsAt: atStart,
    endsAt: atEnd,
    now,
  }),
  'An unconfirmed booking cannot enter the call',
)
expect(
  !shouldEnterCall({
    status: 'cancelled',
    hasSession: true,
    ended: false,
    startsAt: atStart,
    endsAt: atEnd,
    now,
  }),
  '8. A cancelled booking cannot enter the call',
)
expect(
  !shouldEnterCall({
    status: 'rejected',
    hasSession: true,
    ended: false,
    startsAt: atStart,
    endsAt: atEnd,
    now,
  }),
  'A rejected booking cannot enter the call',
)
expect(
  !shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: '2026-10-02T02:30:00.000Z',
    endsAt: '2026-10-02T03:30:00.000Z',
    now,
  }),
  '9. A rescheduled booking uses the new start time',
)
expect(
  shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: atStart,
    endsAt: atEnd,
    now,
  }),
  '9. The replacement schedule can be joined at its new start',
)
expect(
  !shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: true,
    startsAt: atStart,
    endsAt: atEnd,
    now,
  }),
  'An ended session cannot be entered',
)

const gateBase = { startsAt: futureStart, endsAt: futureEnd, ended: false, now }
expect(interviewTokenGate({ ...gateBase, role: 'candidate', status: 'confirmed' }) === 'INTERVIEW_NOT_STARTED', 'Candidate token is refused before the join window')
expect(interviewTokenGate({ ...gateBase, role: 'interviewer', status: 'confirmed' }) === 'INTERVIEW_NOT_STARTED', 'Interviewer token is refused before the join window')
expect(
  interviewTokenGate({ role: 'candidate', status: 'confirmed', startsAt: atStart, endsAt: atEnd, ended: false, now }) === 'ok',
  '11. The shared room token is still issued at the start',
)
expect(
  interviewTokenGate({ role: 'interviewer', status: 'confirmed', startsAt: atStart, endsAt: atEnd, ended: false, now }) === 'ok',
  '11. The interviewer uses the same start rule',
)
expect(
  interviewTokenGate({ role: 'candidate', status: 'confirmed', startsAt: atStart, endsAt: atEnd, ended: false, now }) ===
    interviewTokenGate({ role: 'interviewer', status: 'confirmed', startsAt: atStart, endsAt: atEnd, ended: false, now }),
  'Both roles are admitted to the same session',
)
expect(
  interviewTokenGate({ role: 'candidate', status: 'cancelled', startsAt: atStart, endsAt: atEnd, ended: false, now }) === 'booking_not_confirmed',
  '8. A cancelled booking cannot receive a token',
)
expect(
  interviewTokenGate({ role: 'candidate', status: 'rescheduled', startsAt: atStart, endsAt: atEnd, ended: false, now }) ===
    'booking_not_confirmed',
  '9. A retired rescheduled booking cannot receive a token',
)
expect(
  interviewTokenGate({ role: 'interviewer', status: 'rejected', startsAt: atStart, endsAt: atEnd, ended: false, now }) === 'booking_not_confirmed',
  'A rejected booking cannot receive a token',
)
expect(
  interviewTokenGate({ role: 'other', status: 'confirmed', startsAt: atStart, endsAt: atEnd, ended: false, now }) === 'not_authorized',
  '10. A direct request from a non-participant cannot receive a token',
)
expect(
  interviewTokenGate({
    role: 'candidate',
    status: 'confirmed',
    startsAt: '2026-10-03T02:30:00.000Z',
    endsAt: '2026-10-03T03:30:00.000Z',
    ended: false,
    now,
  }) === 'INTERVIEW_NOT_STARTED',
  '9. A rescheduled future time blocks the token',
)
expect(candidateFeedbackAction('completed', true) === 'view', '12. Completed interviews can still open feedback')
expect(candidateFeedbackAction('completed', false) === 'pending', '12. Completed interviews still show pending feedback')
expect(candidateFeedbackAction('in_progress', true) === null, '12. Feedback stays gated on a completed booking')
expect(candidateFeedbackAction('confirmed', false) === null, '12. Confirmation does not open feedback')
expect(
  interviewLobbyStatusCopy({
    startsAtMs: new Date(atStart).getTime(),
    nowMs: new Date(atStart).getTime() - 16 * 60_000,
    roomOpensAtLabel: '2:15 AM',
    canJoin: false,
  }) === 'Interview room opens at 2:15 AM.',
  'Lobby copy before the room opens names the open time',
)
expect(
  interviewLobbyStatusCopy({
    startsAtMs: new Date(atStart).getTime(),
    nowMs: new Date(atStart).getTime() - 10 * 60_000,
    roomOpensAtLabel: '2:15 AM',
    canJoin: true,
  }) === 'Interview room is open. You can join early and wait for the other participant.',
  'Lobby copy after the room opens allows early wait',
)
expect(
  interviewLobbyStatusCopy({
    startsAtMs: new Date(atStart).getTime(),
    nowMs: new Date(atStart).getTime(),
    roomOpensAtLabel: '2:15 AM',
    canJoin: true,
  }) === 'Interview has started.',
  'Lobby copy at the scheduled start says the interview has started',
)
expect(
  interviewLobbyStatusCopy({
    startsAtMs: new Date(atStart).getTime(),
    nowMs: new Date(atStart).getTime() + 16 * 60_000,
    roomOpensAtLabel: '2:15 AM',
    canJoin: false,
  }) === 'No new participants can join.',
  'Lobby copy after the late-join cutoff blocks new participants',
)
expect(waitingLabel('candidate') === 'Waiting for interviewer', 'Candidate waits for the interviewer')
expect(waitingLabel('interviewer') === 'Waiting for candidate', 'Interviewer waits for the candidate')
expect(remoteLeftLabel('candidate') === 'Interviewer has left the call', 'Candidate sees the interviewer leave')
expect(remoteLeftLabel('interviewer') === 'Candidate has left the call', 'Interviewer sees the candidate leave')

expect(reduceCallPresence('connecting', 'connected') === 'waiting', 'Connection waits for the other participant')
expect(reduceCallPresence('waiting', 'remote_joined') === 'live', 'Remote join makes the call live')
expect(reduceCallPresence('live', 'remote_left') === 'remote_left', 'Remote leave is shown')
expect(reduceCallPresence('live', 'local_end') === 'ended', 'Ending the call stops presence')
expect(reduceCallPresence('live', 'cleanup') === 'ended', 'Disconnect cleanup ends the call')
expect(reduceCallPresence('connecting', 'failed') === 'failed', 'Connection failure is visible')

const token = parseInterviewToken({
  livekit_url: 'wss://example.livekit.cloud',
  token: 'signed-token',
  room_name: room,
  participant_identity: participantIdentity('candidate', candidateUser),
})
expect(token?.roomName === room, 'Token room matches the session room')
expect(roleFromIdentity(token?.participantIdentity ?? '') === 'candidate', 'Token identity keeps the candidate role')
expect(
  parseInterviewToken({
    livekit_url: 'wss://example.livekit.cloud',
    token: 'LIVEKIT_API_SECRET',
    room_name: room,
    participant_identity: participantIdentity('candidate', candidateUser),
  }) == null,
  'A payload carrying the API secret is rejected',
)

console.log('interview call checks passed')
