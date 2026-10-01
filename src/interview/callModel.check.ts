import {
  confirmationCallTarget,
  interviewCallHref,
  interviewRoomName,
  interviewTokenGate,
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
const liveStart = '2026-09-30T12:10:00.000Z'
const liveEnd = '2026-09-30T13:10:00.000Z'
const futureStart = '2026-10-01T02:30:00.000Z'
const futureEnd = '2026-10-01T03:30:00.000Z'

const candidateHref = confirmationCallTarget({
  role: 'candidate',
  previousStatus: 'requested',
  nextStatus: 'confirmed',
  bookingId,
  currentPath: '/candidate/interviews',
  startsAt: liveStart,
  now,
})
const interviewerHref = confirmationCallTarget({
  role: 'interviewer',
  previousStatus: 'requested',
  nextStatus: 'confirmed',
  bookingId,
  currentPath: '/interviewer/bookings',
  startsAt: liveStart,
  now,
})
expect(candidateHref === interviewCallHref(bookingId, true), 'Candidate confirmation opens the call inside the join window')
expect(interviewerHref === interviewCallHref(bookingId, true), 'Interviewer confirmation opens the same call inside the join window')
expect(candidateHref === interviewerHref, 'Both participants receive the same interview route')
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
    startsAt: liveStart,
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
    startsAt: liveStart,
    now,
  }) == null,
  'Staying on the call does not navigate again',
)

expect(
  shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: liveStart,
    endsAt: liveEnd,
    now,
  }),
  'A confirmed session inside the join window can be entered',
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
    status: 'confirmed',
    hasSession: true,
    ended: false,
    startsAt: '2026-09-30T11:00:00.000Z',
    endsAt: liveEnd,
    now,
  }),
  'A confirmed session whose start time has passed can be entered',
)
expect(
  shouldEnterCall({
    status: 'in_progress',
    hasSession: true,
    ended: false,
    startsAt: liveStart,
    endsAt: liveEnd,
    now,
  }),
  'An in-progress call can still be entered',
)
expect(
  !shouldEnterCall({
    status: 'requested',
    hasSession: false,
    ended: false,
    startsAt: liveStart,
    endsAt: liveEnd,
    now,
  }),
  'An unconfirmed booking cannot enter the call',
)
expect(
  !shouldEnterCall({
    status: 'cancelled',
    hasSession: true,
    ended: false,
    startsAt: liveStart,
    endsAt: liveEnd,
    now,
  }),
  'A cancelled booking cannot enter the call',
)
expect(
  !shouldEnterCall({
    status: 'rejected',
    hasSession: true,
    ended: false,
    startsAt: liveStart,
    endsAt: liveEnd,
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
  'A rescheduled booking uses the new start time',
)
expect(
  !shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: true,
    startsAt: liveStart,
    endsAt: liveEnd,
    now,
  }),
  'An ended session cannot be entered',
)

const gateBase = { startsAt: futureStart, endsAt: futureEnd, ended: false, now }
expect(interviewTokenGate({ ...gateBase, role: 'candidate', status: 'confirmed' }) === 'INTERVIEW_NOT_STARTED', 'Candidate token is refused before the join window')
expect(interviewTokenGate({ ...gateBase, role: 'interviewer', status: 'confirmed' }) === 'INTERVIEW_NOT_STARTED', 'Interviewer token is refused before the join window')
expect(
  interviewTokenGate({ role: 'candidate', status: 'confirmed', startsAt: liveStart, endsAt: liveEnd, ended: false, now }) === 'ok',
  'Candidate token is allowed inside the join window',
)
expect(
  interviewTokenGate({ role: 'interviewer', status: 'confirmed', startsAt: liveStart, endsAt: liveEnd, ended: false, now }) === 'ok',
  'Interviewer token is allowed inside the join window',
)
expect(
  interviewTokenGate({ role: 'candidate', status: 'confirmed', startsAt: liveStart, endsAt: liveEnd, ended: false, now }) ===
    interviewTokenGate({ role: 'interviewer', status: 'confirmed', startsAt: liveStart, endsAt: liveEnd, ended: false, now }),
  'Both roles are admitted to the same session',
)
expect(
  interviewTokenGate({ role: 'candidate', status: 'cancelled', startsAt: liveStart, endsAt: liveEnd, ended: false, now }) === 'booking_not_confirmed',
  'A cancelled booking cannot receive a token',
)
expect(
  interviewTokenGate({ role: 'interviewer', status: 'rejected', startsAt: liveStart, endsAt: liveEnd, ended: false, now }) === 'booking_not_confirmed',
  'A rejected booking cannot receive a token',
)
expect(
  interviewTokenGate({ role: 'other', status: 'confirmed', startsAt: liveStart, endsAt: liveEnd, ended: false, now }) === 'not_authorized',
  'An unauthorized user cannot receive a token',
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
  'A rescheduled future time blocks the token',
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
