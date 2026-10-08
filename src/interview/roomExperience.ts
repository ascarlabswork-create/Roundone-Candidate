export const INTERVIEW_MESSAGE_MAX = 2000
export const INTERVIEW_NOTES_MAX = 20000
export const INTERVIEW_FEEDBACK_MAX = 4000

export type InterviewChatMessage = {
  id: string
  interviewSessionId: string
  senderUserId: string
  message: string
  createdAt: string
}

export type InterviewRecordingState = 'idle' | 'recording' | 'stopped' | 'failed'

export function normalizeInterviewMessage(value: string) {
  const text = value.trim()
  if (!text || text.length > INTERVIEW_MESSAGE_MAX) return null
  return text
}

export function normalizeInterviewNotes(value: string) {
  if (value.length > INTERVIEW_NOTES_MAX) return null
  return value
}

export function normalizeAppFeedback(input: {
  rating: number | null
  feedback: string
  suggestions: string
}) {
  const feedback = input.feedback.trim()
  const suggestions = input.suggestions.trim()
  const rating =
    input.rating != null && input.rating >= 1 && input.rating <= 5 ? input.rating : null
  if (feedback.length > INTERVIEW_FEEDBACK_MAX || suggestions.length > INTERVIEW_FEEDBACK_MAX) return null
  if (rating == null && !feedback && !suggestions) return null
  return { rating, feedback, suggestions }
}

export function parseInterviewMessage(value: unknown): InterviewChatMessage | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const id = row.id
  const interviewSessionId = row.interview_session_id
  const senderUserId = row.sender_user_id
  const message = row.message
  const createdAt = row.created_at
  if (
    typeof id !== 'string' ||
    typeof interviewSessionId !== 'string' ||
    typeof senderUserId !== 'string' ||
    typeof message !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null
  }
  if (!normalizeInterviewMessage(message)) return null
  return { id, interviewSessionId, senderUserId, message: message.trim(), createdAt }
}

export function mergeInterviewMessages(current: InterviewChatMessage[], incoming: InterviewChatMessage) {
  if (current.some((item) => item.id === incoming.id)) return current
  return [...current, incoming].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export function unreadChatCount(messages: InterviewChatMessage[], userId: string, seenIds: ReadonlySet<string>) {
  return messages.filter((item) => item.senderUserId !== userId && !seenIds.has(item.id)).length
}

export function parseRecordingStatus(value: unknown): InterviewRecordingState {
  if (!value || typeof value !== 'object') return 'idle'
  const status = (value as Record<string, unknown>).status
  if (status === 'recording' || status === 'stopped' || status === 'failed') return status
  return 'idle'
}

export function parseRecordingStoragePath(value: unknown, sessionId?: string) {
  if (!value || typeof value !== 'object') return null
  const path = (value as Record<string, unknown>).storage_path
  if (typeof path !== 'string' || !path.startsWith('interviews/') || !path.endsWith('.mp4')) return null
  if (sessionId && !path.startsWith(`interviews/${sessionId}/`)) return null
  return path
}

export function canSaveInterviewRecording(status: InterviewRecordingState, storagePath: string | null) {
  return status === 'stopped' && Boolean(storagePath)
}

export function chatSenderLabel(senderUserId: string, userId: string, remoteName: string) {
  return senderUserId === userId ? 'You' : remoteName
}

export function formatChatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
