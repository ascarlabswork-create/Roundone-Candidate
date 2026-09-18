import {
  isUnread,
  parseCandidateNotification,
  parseNotificationPreferences,
  prefersBookingUpdates,
} from './notificationModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runNotificationChecks() {
  const secret = 'INTERNAL — candidate must never see this'
  const parsed = parseCandidateNotification({
    id: '00000000-0000-4000-8000-000000000061',
    kind: 'feedback_ready',
    title: 'Interview feedback is ready',
    body: 'Your interview feedback is available.',
    payload: {
      booking_id: '00000000-0000-4000-8000-000000000021',
      internal_notes: secret,
    },
    read_at: null,
    created_at: '2026-09-18T08:00:00.000Z',
  })

  expect(Boolean(parsed), 'Notification rows must parse')
  expect(parsed?.bookingId === '00000000-0000-4000-8000-000000000021', 'Only booking_id is read from payload')
  expect(!JSON.stringify(parsed).includes(secret), 'Internal notes must not leak into notification records')
  expect(isUnread(parsed!), 'Null read_at is unread')

  const prefs = parseNotificationPreferences({
    email_enabled: true,
    booking_updates: false,
    feedback_updates: true,
    marketing: false,
  })
  expect(Boolean(prefs), 'Preferences must parse')
  expect(prefs?.bookingUpdates === false, 'booking_updates maps')
  expect(prefersBookingUpdates(prefs!, 'booking_confirmed') === false, 'Booking events respect booking_updates')
  expect(prefersBookingUpdates(prefs!, 'feedback_ready') === true, 'Feedback events use feedback_updates')

  const read = parseCandidateNotification({
    id: '00000000-0000-4000-8000-000000000062',
    kind: 'booking_confirmed',
    title: 'Interview confirmed',
    body: 'Your interviewer confirmed the booking.',
    payload: { booking_id: '00000000-0000-4000-8000-000000000022' },
    read_at: '2026-09-18T09:00:00.000Z',
    created_at: '2026-09-18T08:30:00.000Z',
  })
  expect(read != null && !isUnread(read), 'read_at marks a notification as read')

  return true
}

runNotificationChecks()
console.log('candidate notification checks passed')
