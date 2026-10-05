import {
  LATE_JOIN_AFTER_MS,
  ROOM_OPENS_BEFORE_MS,
} from '../services/interviewSessionModel.ts'

const ROOM_PREFIX = 'roundone-interview-'

export const INTERVIEW_ROOM_OPENS_BEFORE_MS = ROOM_OPENS_BEFORE_MS
export const INTERVIEW_LOBBY_BEFORE_MS = ROOM_OPENS_BEFORE_MS
export const INTERVIEW_LATE_JOIN_MS = LATE_JOIN_AFTER_MS

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

/** LiveKit opens 15 minutes before `starts_at` and a new join stays open for 15 minutes after that. */
export function isInsideJoinWindow(startsAt: string | null | undefined, now = new Date()) {
  if (!startsAt) return false
  const start = new Date(startsAt).getTime()
  if (Number.isNaN(start)) return false
  const t = now.getTime()
  return t >= start - INTERVIEW_ROOM_OPENS_BEFORE_MS && t <= start + INTERVIEW_LATE_JOIN_MS
}

export function isLobbyOpen(startsAt: string | null | undefined, now = new Date()) {
  if (!startsAt) return false
  const start = new Date(startsAt).getTime()
  if (Number.isNaN(start)) return false
  const t = now.getTime()
  return t >= start - INTERVIEW_ROOM_OPENS_BEFORE_MS && t < start
}

export function interviewLobbyStatusCopy(input: {
  startsAtMs: number
  nowMs: number
  roomOpensAtLabel: string
  canJoin: boolean
}) {
  if (input.nowMs < input.startsAtMs - INTERVIEW_ROOM_OPENS_BEFORE_MS) {
    return `Interview room opens at ${input.roomOpensAtLabel}.`
  }
  if (input.nowMs < input.startsAtMs) {
    return 'Interview room is open. You can join early and wait for the other participant.'
  }
  if (input.canJoin) return 'Interview has started.'
  return 'No new participants can join.'
}

export function confirmationCallTarget(input: {
  role: CallRole
  previousStatus: string
  nextStatus: string
  bookingId: string
  currentPath: string
  startsAt?: string | null
  now?: Date
}) {
  if (!shouldOpenCallOnConfirmation(input.previousStatus, input.nextStatus)) return null
  if (!isInsideJoinWindow(input.startsAt, input.now)) return null
  const href = interviewCallHref(input.bookingId, true)
  if (input.currentPath.startsWith(`/candidate/interview/${input.bookingId}`)) return null
  return href
}

export function shouldEnterCall(input: {
  status: string
  hasSession: boolean
  ended: boolean
  startsAt: string
  endsAt: string
  now?: Date
}) {
  if (!input.hasSession || input.ended) return false
  if (input.status !== 'confirmed' && input.status !== 'in_progress') return false
  const now = input.now ?? new Date()
  const start = new Date(input.startsAt).getTime()
  const end = new Date(input.endsAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || now.getTime() >= end) return false
  if (now.getTime() < start - INTERVIEW_ROOM_OPENS_BEFORE_MS) return false
  if (input.status === 'in_progress') return true
  return isInsideJoinWindow(input.startsAt, now)
}

/**
 * Server token rule, mirrored for tests. Authorization uses `bookings.starts_at`
 * (timestamptz) compared with database `now()`, not a formatted clock string.
 */
export function interviewTokenGate(input: {
  role: CallRole | 'other'
  status: string
  startsAt: string
  endsAt: string
  ended: boolean
  now?: Date
}): 'ok' | 'not_authorized' | 'booking_not_confirmed' | 'INTERVIEW_NOT_STARTED' | 'JOIN_WINDOW_CLOSED' | 'session_expired' {
  if (input.role !== 'candidate' && input.role !== 'interviewer') return 'not_authorized'
  if (input.status !== 'confirmed' && input.status !== 'in_progress') return 'booking_not_confirmed'
  const now = input.now ?? new Date()
  const start = new Date(input.startsAt).getTime()
  const end = new Date(input.endsAt).getTime()
  if (input.ended || Number.isNaN(start) || Number.isNaN(end) || now.getTime() >= end) return 'session_expired'
  if (now.getTime() < start - INTERVIEW_ROOM_OPENS_BEFORE_MS) return 'INTERVIEW_NOT_STARTED'
  if (input.status === 'confirmed' && now.getTime() > start + INTERVIEW_LATE_JOIN_MS) return 'JOIN_WINDOW_CLOSED'
  return 'ok'
}

export function scheduledInterviewLabel(startsAt: string | null | undefined) {
  if (!startsAt) return 'the scheduled time'
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return 'the scheduled time'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(date)
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
