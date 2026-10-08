import {
  canSaveInterviewRecording,
  chatSenderLabel,
  formatChatTime,
  mergeInterviewMessages,
  normalizeAppFeedback,
  normalizeInterviewMessage,
  normalizeInterviewNotes,
  parseInterviewMessage,
  parseRecordingStatus,
  parseRecordingStoragePath,
  unreadChatCount,
} from './roomExperience.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(normalizeInterviewMessage('  hello  ') === 'hello', 'messages are trimmed')
expect(normalizeInterviewMessage('   ') === null, 'empty messages are rejected')
expect(normalizeInterviewMessage('x'.repeat(2000))?.length === 2000, '2000 characters are allowed')
expect(normalizeInterviewMessage('x'.repeat(2001)) === null, 'messages over 2000 are rejected')
expect(normalizeInterviewNotes('a'.repeat(20000))?.length === 20000, 'notes allow 20000 characters')
expect(normalizeInterviewNotes('a'.repeat(20001)) === null, 'notes over 20000 are rejected')

const feedback = normalizeAppFeedback({ rating: 4, feedback: '  clear audio  ', suggestions: '  captions  ' })
expect(feedback?.rating === 4 && feedback.feedback === 'clear audio' && feedback.suggestions === 'captions', 'feedback is trimmed')
expect(normalizeAppFeedback({ rating: null, feedback: ' ', suggestions: ' ' }) === null, 'blank feedback is rejected')
expect(normalizeAppFeedback({ rating: 9, feedback: '', suggestions: '' }) === null, 'ratings outside 1-5 are rejected')
expect(normalizeAppFeedback({ rating: null, feedback: '', suggestions: 'add a timer' })?.suggestions === 'add a timer', 'suggestions alone are enough')

const parsed = parseInterviewMessage({
  id: 'm1',
  interview_session_id: 's1',
  sender_user_id: 'u1',
  message: '  hello  ',
  created_at: '2026-10-06T12:00:00.000Z',
})
expect(parsed?.message === 'hello' && parsed.interviewSessionId === 's1', 'chat rows parse')
expect(parseInterviewMessage({ id: 'm1', message: '   ' }) === null, 'invalid chat rows are dropped')

const first = parsed!
const second = { ...first, id: 'm2', senderUserId: 'u2', createdAt: '2026-10-06T12:00:01.000Z', message: 'reply' }
const merged = mergeInterviewMessages(mergeInterviewMessages([first], second), second)
expect(merged.length === 2 && merged[1]?.id === 'm2', 'duplicate realtime events are ignored')

const seen = new Set(['m1'])
expect(unreadChatCount(merged, 'u1', seen) === 1, 'unread counts only the other person')
expect(unreadChatCount(merged, 'u2', new Set(['m1', 'm2'])) === 0, 'seen messages are not unread')
expect(chatSenderLabel('u1', 'u1', 'Alex') === 'You', 'own messages are labeled You')
expect(chatSenderLabel('u2', 'u1', 'Alex') === 'Alex', 'remote messages use the other name')
expect(formatChatTime('not-a-date') === '', 'bad timestamps stay blank')
expect(parseRecordingStatus({ status: 'recording' }) === 'recording', 'recording status parses')
expect(parseRecordingStatus({ status: 'public' }) === 'idle', 'unknown recording status is idle')
expect(parseRecordingStatus(null) === 'idle', 'missing recording is idle')

const session = '00000000-0000-4000-8000-0000000000aa'
const stored = `interviews/${session}/00000000-0000-4000-8000-0000000000bb.mp4`
expect(parseRecordingStoragePath({ storage_path: stored }, session) === stored, 'recording path stays inside the session')
expect(parseRecordingStoragePath({ storage_path: 'interviews/other/file.mp4' }, session) === null, 'another session path is rejected')
expect(parseRecordingStoragePath({ storage_path: 'https://example.com/file.mp4' }) === null, 'public urls are not recording paths')
expect(canSaveInterviewRecording('stopped', stored), 'a stopped recording can be saved')
expect(!canSaveInterviewRecording('recording', stored), 'an active recording is not saved yet')
expect(!canSaveInterviewRecording('stopped', null), 'a stop without a file cannot be saved')

console.log('roomExperience.check passed')
