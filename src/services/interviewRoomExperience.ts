import {
  normalizeAppFeedback,
  normalizeInterviewMessage,
  normalizeInterviewNotes,
  parseInterviewMessage,
  parseRecordingStatus,
  parseRecordingStoragePath,
  type InterviewChatMessage,
  type InterviewRecordingState,
} from '../interview/roomExperience.ts'
import { supabase } from '../lib/supabase.ts'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

async function readFunctionError(error: unknown, data: unknown) {
  const body = asRecord(data)
  if (typeof body?.error === 'string') return body.error
  const response = (error as { context?: { clone?: () => { json?: () => Promise<unknown> } } }).context
  if (response && typeof response.clone === 'function') {
    try {
      const parsed = asRecord(await response.clone().json?.())
      if (typeof parsed?.error === 'string') return parsed.error
    } catch {
      // The function body is optional. Fall through to the message.
    }
  }
  const message = error instanceof Error ? error.message : ''
  if (message.includes('recording_unconfigured')) return 'recording_unconfigured'
  if (message.includes('not_authorized')) return 'not_authorized'
  if (message.includes('session_expired')) return 'session_expired'
  if (message.includes('booking_not_confirmed')) return 'booking_not_confirmed'
  if (message.includes('not_authenticated')) return 'not_authenticated'
  return 'recording_failed'
}

export function recordingErrorMessage(code: string) {
  if (code === 'recording_unconfigured') return 'Recording could not start. Please try again in a moment.'
  if (code === 'not_authorized') return 'You cannot record this interview.'
  if (code === 'session_expired') return 'This interview session has ended.'
  if (code === 'booking_not_confirmed') return 'This interview is not confirmed yet.'
  if (code === 'not_authenticated') return 'Please sign in to record this interview.'
  if (code === 'not_recording') return 'Recording is not active.'
  if (code === 'recording_processing') return 'The recording is still being saved to this interview. Try Save again in a moment.'
  return 'Recording could not be updated. Please try again.'
}

export type InterviewRecordingSnapshot = {
  status: InterviewRecordingState
  storagePath: string | null
  downloadUrl: string | null
}

export async function loadInterviewMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('interview_messages')
    .select('id, interview_session_id, sender_user_id, message, created_at')
    .eq('interview_session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error('Unable to load chat.')
  return (data ?? []).flatMap((row) => {
    const message = parseInterviewMessage(row)
    return message ? [message] : []
  })
}

export async function sendInterviewMessage(sessionId: string, userId: string, draft: string) {
  const message = normalizeInterviewMessage(draft)
  if (!message) return null
  const { data, error } = await supabase
    .from('interview_messages')
    .insert({
      interview_session_id: sessionId,
      sender_user_id: userId,
      message,
    })
    .select('id, interview_session_id, sender_user_id, message, created_at')
    .single()
  if (error) throw new Error('Unable to send message.')
  return parseInterviewMessage(data)
}

export async function loadInterviewNotes(sessionId: string) {
  const { data, error } = await supabase
    .from('interview_notes')
    .select('notes')
    .eq('interview_session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error('Unable to load notes.')
  return typeof data?.notes === 'string' ? data.notes : ''
}

export async function saveInterviewNotes(sessionId: string, userId: string, notes: string) {
  const text = normalizeInterviewNotes(notes)
  if (text == null) throw new Error('Notes are too long.')
  const { error } = await supabase.from('interview_notes').upsert(
    {
      interview_session_id: sessionId,
      user_id: userId,
      notes: text,
    },
    { onConflict: 'interview_session_id,user_id' },
  )
  if (error) throw new Error('Unable to save notes.')
}

export async function loadInterviewRecording(sessionId: string): Promise<InterviewRecordingSnapshot> {
  const { data, error } = await supabase
    .from('interview_recordings')
    .select('status, storage_path')
    .eq('interview_session_id', sessionId)
    .maybeSingle()
  if (error || !data) return { status: 'idle', storagePath: null, downloadUrl: null }
  return {
    status: parseRecordingStatus(data),
    storagePath: parseRecordingStoragePath(data, sessionId),
    downloadUrl: null,
  }
}

export async function requestInterviewRecording(sessionId: string, action: 'start' | 'stop' | 'save') {
  const { data, error } = await supabase.functions.invoke('interview-recording', {
    body: { interview_session_id: sessionId, action },
  })
  if (error) {
    const code = await readFunctionError(error, data)
    throw new Error(recordingErrorMessage(code))
  }
  const status = parseRecordingStatus(data)
  const record = asRecord(data)
  const downloadUrl = typeof record?.download_url === 'string' ? record.download_url : null
  return {
    status: status === 'idle' ? (action === 'start' ? 'recording' : 'stopped') : status,
    storagePath: parseRecordingStoragePath(data, sessionId),
    downloadUrl,
  } satisfies InterviewRecordingSnapshot
}

export type InterviewAppFeedbackDraft = {
  rating: number | null
  feedback: string
  suggestions: string
}

export async function loadInterviewAppFeedback(sessionId: string): Promise<InterviewAppFeedbackDraft | null> {
  const { data, error } = await supabase
    .from('interview_app_feedback')
    .select('rating, feedback, suggestions')
    .eq('interview_session_id', sessionId)
    .maybeSingle()
  if (error || !data) return null
  const rating = typeof data.rating === 'number' ? data.rating : null
  return {
    rating,
    feedback: typeof data.feedback === 'string' ? data.feedback : '',
    suggestions: typeof data.suggestions === 'string' ? data.suggestions : '',
  }
}

export async function saveInterviewAppFeedback(sessionId: string, userId: string, draft: InterviewAppFeedbackDraft) {
  const normalized = normalizeAppFeedback(draft)
  if (!normalized) throw new Error('Add a rating or a comment before sending.')
  const { error } = await supabase.from('interview_app_feedback').upsert(
    {
      interview_session_id: sessionId,
      user_id: userId,
      participant_role: 'candidate',
      rating: normalized.rating,
      feedback: normalized.feedback,
      suggestions: normalized.suggestions,
    },
    { onConflict: 'interview_session_id,user_id' },
  )
  if (error) throw new Error('Unable to send feedback.')
}

export function subscribeInterviewMessages(
  sessionId: string,
  onMessage: (message: InterviewChatMessage) => void,
  onResync: () => void,
) {
  const channel = supabase
    .channel(`interview-messages-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'interview_messages',
        filter: `interview_session_id=eq.${sessionId}`,
      },
      (payload) => {
        const message = parseInterviewMessage(payload.new)
        if (message && message.interviewSessionId === sessionId) onMessage(message)
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onResync()
    })
  return () => {
    void supabase.removeChannel(channel)
  }
}

export function subscribeInterviewRecording(
  sessionId: string,
  onStatus: (snapshot: InterviewRecordingSnapshot) => void,
) {
  const channel = supabase
    .channel(`interview-recording-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'interview_recordings',
        filter: `interview_session_id=eq.${sessionId}`,
      },
      (payload) => {
        const row = payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old
        onStatus({
          status: parseRecordingStatus(row),
          storagePath: parseRecordingStoragePath(row, sessionId),
          downloadUrl: null,
        })
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void loadInterviewRecording(sessionId).then(onStatus)
    })
  return () => {
    void supabase.removeChannel(channel)
  }
}
