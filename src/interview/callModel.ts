const ROOM_PREFIX = 'roundone-interview-'
const CALL_GRACE_MS = 30 * 60_000

export type CallRole = 'candidate' | 'interviewer'

export type CallPresence = 'connecting' | 'waiting' | 'live' | 'remote_left' | 'ended' | 'failed'

export function interviewRoomName(sessionId: string) {
  return `${ROOM_PREFIX}${sessionId}`
}

export function participantIdentity(role: CallRole, userId: string) {
  return `${role}:${userId}`
}

export function interviewCallHref(bookingId: string, accepted = false) {
  return `/candidate/interview/${bookingId}?join=1${accepted ? '&accepted=1' : ''}`
}

export function shouldOpenCallOnConfirmation(previousStatus: string, nextStatus: string) {
  return previousStatus !== 'confirmed' && previousStatus !== 'in_progress' && nextStatus === 'confirmed'
}

export function confirmationCallTarget(input: {
  role: CallRole
  previousStatus: string
  nextStatus: string
  bookingId: string
  currentPath: string
}) {
  if (!shouldOpenCallOnConfirmation(input.previousStatus, input.nextStatus)) return null
  const href = interviewCallHref(input.bookingId, true)
  if (input.currentPath.startsWith(`/candidate/interview/${input.bookingId}`)) return null
  return href
}

export function shouldEnterCall(input: {
  status: string
  hasSession: boolean
  ended: boolean
  endsAt: string
  now?: Date
}) {
  if (!input.hasSession || input.ended) return false
  if (input.status !== 'confirmed' && input.status !== 'in_progress') return false
  const end = new Date(input.endsAt).getTime()
  if (Number.isNaN(end)) return false
  return (input.now ?? new Date()).getTime() <= end + CALL_GRACE_MS
}

export function waitingLabel(role: CallRole) {
  return role === 'candidate' ? 'Waiting for interviewer' : 'Waiting for candidate'
}

export function remoteLeftLabel(role: CallRole) {
  return role === 'candidate' ? 'Interviewer has left the call' : 'Candidate has left the call'
}

export function reduceCallPresence(
  current: CallPresence,
  event: 'connected' | 'remote_joined' | 'remote_left' | 'local_end' | 'failed' | 'cleanup',
): CallPresence {
  if (event === 'cleanup' || event === 'local_end') return 'ended'
  if (event === 'failed') return 'failed'
  if (current === 'ended' || current === 'failed') return current
  if (event === 'remote_joined') return 'live'
  if (event === 'remote_left') return 'remote_left'
  if (event === 'connected') return current === 'live' ? 'live' : 'waiting'
  return current
}

export function sameInterviewRoom(sessionId: string) {
  return interviewRoomName(sessionId) === interviewRoomName(sessionId)
}

export type InterviewTokenFields = {
  livekitUrl: string
  token: string
  roomName: string
  participantIdentity: string
}

export function parseInterviewToken(value: unknown): InterviewTokenFields | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const livekitUrl = typeof row.livekit_url === 'string' ? row.livekit_url : ''
  const token = typeof row.token === 'string' ? row.token : ''
  const roomName = typeof row.room_name === 'string' ? row.room_name : ''
  const participantIdentity = typeof row.participant_identity === 'string' ? row.participant_identity : ''
  if (!livekitUrl || !token || !roomName.startsWith('roundone-interview-') || !participantIdentity) return null
  if (livekitUrl.includes('LIVEKIT_API_SECRET') || token.includes('LIVEKIT_API_SECRET')) return null
  return { livekitUrl, token, roomName, participantIdentity }
}

export function roleFromIdentity(identity: string): CallRole | null {
  if (identity.startsWith('candidate:')) return 'candidate'
  if (identity.startsWith('interviewer:')) return 'interviewer'
  return null
}
