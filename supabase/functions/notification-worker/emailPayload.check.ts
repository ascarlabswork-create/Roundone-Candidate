import { emailDeepLink, emailSubject, n8nEmailPayload, n8nPayloadKeys } from './emailPayload.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const bookingId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const interviewerEmail = 'interviewer.auth@example.test'
const candidateEmail = 'candidate.auth@example.test'

const requested = n8nEmailPayload({
  deliveryId: '11111111-1111-4111-8111-111111111111',
  notificationId: '22222222-2222-4222-8222-222222222222',
  channel: 'email',
  recipient: interviewerEmail,
  eventKind: 'booking_requested',
  title: 'New booking request',
  bookingId,
  deepLinkPath: `/interviewer/bookings/${bookingId}`,
})

expect(requested.recipient === interviewerEmail, 'booking_requested recipient is the server-resolved interviewer address')
expect(requested.subject === 'New Interview Booking Request', 'booking_requested subject')
expect(requested.event_kind === 'booking_requested', 'booking_requested event_kind')
expect(
  requested.deep_link_path === `/interviewer/bookings?tab=pending&booking=${bookingId}`,
  'booking_requested deep link uses the pending tab',
)
expect(requested.channel === 'email', 'channel is email')
expect(requested.booking_id === bookingId, 'booking id is forwarded')

const confirmed = n8nEmailPayload({
  deliveryId: '33333333-3333-4333-8333-333333333333',
  notificationId: '44444444-4444-4444-8444-444444444444',
  channel: 'email',
  recipient: candidateEmail,
  eventKind: 'booking_confirmed',
  title: 'Interview confirmed',
  bookingId,
  deepLinkPath: null,
})
expect(confirmed.recipient === candidateEmail, 'booking_confirmed recipient is the server-resolved candidate address')
expect(confirmed.subject === 'Your interview is confirmed', 'booking_confirmed subject')
expect(confirmed.deep_link_path === `/candidate/interview/${bookingId}`, 'confirmed deep link')

const rejected = n8nEmailPayload({
  deliveryId: '55555555-5555-4555-8555-555555555555',
  notificationId: '66666666-6666-4666-8666-666666666666',
  channel: 'email',
  recipient: candidateEmail,
  eventKind: 'booking_rejected',
  title: 'Booking declined',
  bookingId,
  deepLinkPath: null,
})
expect(rejected.recipient === candidateEmail, 'booking_rejected recipient is the server-resolved candidate address')
expect(rejected.subject === 'Your booking request was declined', 'booking_rejected subject')
expect(rejected.deep_link_path === '/candidate/interviews', 'rejected deep link')

const keys = n8nPayloadKeys(requested)
expect(
  JSON.stringify(keys) ===
    JSON.stringify([
      'booking_id',
      'channel',
      'deep_link_path',
      'delivery_id',
      'event_kind',
      'notification_id',
      'recipient',
      'subject',
    ]),
  'n8n payload has only the delivery fields',
)

const serialized = JSON.stringify(requested)
expect(!serialized.includes('service_role'), 'payload has no service role')
expect(!serialized.includes('NOTIFICATION_WORKER_SECRET'), 'payload has no worker secret')
expect(!serialized.includes('N8N_NOTIFICATION_WEBHOOK_SECRET'), 'payload has no webhook secret')
expect(!serialized.includes('resume'), 'payload has no resume text')
expect(!serialized.includes('@ascarlabs.com'), 'payload does not hard-code a recipient or sender')
expect(requested.recipient !== 'notifications@ascarlabs.com', 'recipient stays dynamic')
expect(emailSubject('booking_requested', 'New booking request') === 'New Interview Booking Request', 'subject map')
expect(
  emailDeepLink({
    eventKind: 'booking_requested',
    bookingId,
    deepLinkPath: '/interviewer/bookings/' + bookingId,
  }) === `/interviewer/bookings?tab=pending&booking=${bookingId}`,
  'worker overrides the legacy booking path',
)

console.log('notification email payload checks passed')
