import {
  confirmationCallTarget,
  interviewCallHref,
  interviewRoomName,
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

const candidateHref = confirmationCallTarget({
  role: 'candidate',
  previousStatus: 'requested',
  nextStatus: 'confirmed',
  bookingId,
  currentPath: '/candidate/interviews',
})
const interviewerHref = confirmationCallTarget({
  role: 'interviewer',
  previousStatus: 'requested',
  nextStatus: 'confirmed',
  bookingId,
  currentPath: '/interviewer/bookings',
})
expect(candidateHref === interviewCallHref(bookingId, true), 'Candidate confirmation opens the call')
expect(interviewerHref === interviewCallHref(bookingId, true), 'Interviewer confirmation opens the same call')
expect(candidateHref === interviewerHref, 'Both participants receive the same interview route')
expect(
  confirmationCallTarget({
    role: 'candidate',
    previousStatus: 'confirmed',
    nextStatus: 'confirmed',
    bookingId,
    currentPath: '/candidate/interviews',
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
  }) == null,
  'Staying on the call does not navigate again',
)

const now = new Date('2026-09-30T12:00:00.000Z')
expect(
  shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: false,
    endsAt: '2026-09-30T13:00:00.000Z',
    now,
  }),
  'A confirmed session can be entered',
)
expect(
  !shouldEnterCall({
    status: 'requested',
    hasSession: false,
    ended: false,
    endsAt: '2026-09-30T13:00:00.000Z',
    now,
  }),
  'An unconfirmed booking cannot enter the call',
)
expect(
  !shouldEnterCall({
    status: 'confirmed',
    hasSession: true,
    ended: true,
    endsAt: '2026-09-30T13:00:00.000Z',
    now,
  }),
  'An ended session cannot be entered',
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
