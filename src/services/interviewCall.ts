import { supabase } from '../lib/supabase.ts'
import { parseInterviewToken } from '../interview/callModel.ts'

export type InterviewToken = {
  livekitUrl: string
  token: string
  roomName: string
  participantIdentity: string
}

export class InterviewCallError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function interviewCallErrorMessage(code: string) {
  if (code === 'not_authenticated') return 'Please sign in to join this interview.'
  if (code === 'booking_not_confirmed') return 'This interview is not confirmed yet.'
  if (code === 'INTERVIEW_NOT_STARTED' || code === 'interview_not_started') {
    return "Your interview hasn't started yet."
  }
  if (code === 'session_expired') return 'This interview session has ended.'
  if (code === 'session_not_found') return 'This interview session could not be found.'
  if (code === 'not_authorized') return 'You are not a participant in this interview.'
  if (code === 'unconfigured') return 'Video calling is not configured yet.'
  if (code === 'permission') return 'Camera or microphone permission was denied.'
  if (code === 'connection') return 'The video call could not connect. Please try again.'
  return 'The video call could not be started.'
}

export async function requestInterviewToken(input: { bookingId?: string; sessionId?: string }) {
  const { data, error } = await supabase.functions.invoke('create-interview-token', {
    body: {
      booking_id: input.bookingId ?? null,
      interview_session_id: input.sessionId ?? null,
    },
  })
  if (error) {
    const code = readErrorCode(error, data)
    throw new InterviewCallError(code, interviewCallErrorMessage(code))
  }
  const token = parseInterviewToken(data)
  if (!token) throw new InterviewCallError('not_authorized', interviewCallErrorMessage('not_authorized'))
  return token
}

export async function beginInterviewCall(sessionId: string) {
  const { error } = await supabase.rpc('begin_interview_call', { p_session_id: sessionId })
  if (error) {
    const code = error.message.includes('interview_not_started') || error.message.includes('INTERVIEW_NOT_STARTED')
      ? 'INTERVIEW_NOT_STARTED'
      : error.message.includes('booking_not_confirmed')
        ? 'booking_not_confirmed'
        : error.message.includes('not_authorized')
          ? 'not_authorized'
          : 'connection'
    throw new InterviewCallError(code, interviewCallErrorMessage(code))
  }
}

export async function recordInterviewCallEvent(sessionId: string, event: 'participant_left' | 'call_ended') {
  const { error } = await supabase.rpc('record_interview_call_event', {
    p_session_id: sessionId,
    p_event: event,
  })
  if (error) throw new InterviewCallError('connection', interviewCallErrorMessage('connection'))
}

function readErrorCode(error: { message?: string; context?: unknown }, data: unknown) {
  const body = asRecord(data)
  if (typeof body?.error === 'string') return body.error
  const message = error.message ?? ''
  if (message.includes('INTERVIEW_NOT_STARTED') || message.includes('interview_not_started')) {
    return 'INTERVIEW_NOT_STARTED'
  }
  if (message.includes('booking_not_confirmed')) return 'booking_not_confirmed'
  if (message.includes('session_expired')) return 'session_expired'
  if (message.includes('session_not_found')) return 'session_not_found'
  if (message.includes('not_authorized')) return 'not_authorized'
  if (message.includes('not_authenticated') || message.includes('401')) return 'not_authenticated'
  if (message.includes('unconfigured')) return 'unconfigured'
  return 'connection'
}
