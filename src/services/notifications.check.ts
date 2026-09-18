import {
  formatNotificationTime,
  isUnread,
  notificationHref,
  parseCandidateNotification,
  parseNotificationPreferences,
  prefersOptionalNotification,
  toPreferencePatch,
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
  expect(prefersOptionalNotification(prefs!, 'booking_confirmed') === true, 'Transactional booking events stay on')
  expect(prefersOptionalNotification(prefs!, 'booking_rejected') === true, 'Rejected bookings stay mandatory')
  expect(prefersOptionalNotification(prefs!, 'interview_reminder') === false, 'Reminders follow booking_updates')
  expect(prefersOptionalNotification(prefs!, 'feedback_ready') === true, 'Feedback follows feedback_updates')
  expect(toPreferencePatch({ bookingUpdates: false })?.booking_updates === false, 'Optional reminder patch uses booking_updates')
  expect(toPreferencePatch({ feedbackUpdates: false })?.feedback_updates === false, 'Optional feedback patch uses feedback_updates')
  expect(toPreferencePatch({}) === null, 'Empty preference updates are rejected')
  expect(!('email_enabled' in (toPreferencePatch({ bookingUpdates: true }) ?? {})), 'Email preferences are not updated here')

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
  expect(
    notificationHref(parsed!) === '/candidate/feedback/00000000-0000-4000-8000-000000000021',
    'Feedback notifications route to the feedback page',
  )
  expect(
    notificationHref(read!) === '/candidate/interview/00000000-0000-4000-8000-000000000022',
    'Confirmed bookings route to the interview room',
  )
  expect(
    notificationHref({
      id: '00000000-0000-4000-8000-000000000063',
      kind: 'booking_rejected',
      title: 'Booking declined',
      body: 'The interviewer declined this request.',
      bookingId: '00000000-0000-4000-8000-000000000023',
      readAt: null,
      createdAt: '2026-09-18T08:00:00.000Z',
    }) === '/candidate/interviews',
    'Rejected bookings route to My Interviews',
  )
  expect(
    notificationHref({
      id: '00000000-0000-4000-8000-000000000065',
      kind: 'booking_rescheduled',
      title: 'Interview rescheduled',
      body: 'Your interview time was updated.',
      bookingId: '00000000-0000-4000-8000-000000000024',
      readAt: null,
      createdAt: '2026-09-18T08:00:00.000Z',
    }) === '/candidate/interview/00000000-0000-4000-8000-000000000024',
    'Rescheduled bookings route to interview details',
  )
  expect(
    notificationHref({
      id: '00000000-0000-4000-8000-000000000064',
      kind: 'booking_confirmed',
      title: 'Interview confirmed',
      body: 'Your interviewer confirmed the booking.',
      bookingId: null,
      readAt: null,
      createdAt: '2026-09-18T08:00:00.000Z',
    }) === null,
    'Notifications without a booking stay informational',
  )
  expect(
    formatNotificationTime('2026-09-18T08:50:00.000Z', Date.parse('2026-09-18T09:00:00.000Z')) === '10 min ago',
    'Relative timestamps use minutes',
  )

  return true
}

runNotificationChecks()
console.log('candidate notification checks passed')
