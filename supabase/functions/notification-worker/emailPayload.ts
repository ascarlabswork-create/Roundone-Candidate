export type EmailDeliveryInput = {
  deliveryId: string
  notificationId: string
  channel: string
  recipient: string
  eventKind: string
  title: string
  bookingId: string | null
  deepLinkPath: string | null
}

export type N8nEmailPayload = {
  delivery_id: string
  notification_id: string
  channel: 'email'
  recipient: string
  subject: string
  event_kind: string
  booking_id: string | null
  deep_link_path: string | null
}

const SUBJECTS: Record<string, string> = {
  booking_requested: 'New Interview Booking Request',
  booking_confirmed: 'Your interview is confirmed',
  booking_rejected: 'Your booking request was declined',
}

export function emailSubject(eventKind: string, fallbackTitle: string) {
  return SUBJECTS[eventKind] ?? (fallbackTitle.trim() || 'Notification')
}

export function emailDeepLink(input: {
  eventKind: string
  bookingId: string | null
  deepLinkPath: string | null
}) {
  if (input.eventKind === 'booking_requested' && input.bookingId) {
    return `/interviewer/bookings?tab=pending&booking=${input.bookingId}`
  }
  if (input.eventKind === 'booking_confirmed' && input.bookingId) {
    return `/candidate/interview/${input.bookingId}`
  }
  if (input.eventKind === 'booking_rejected') {
    return '/candidate/interviews'
  }
  return input.deepLinkPath
}

/** Trusted worker payload. Recipient is whatever the server already resolved. */
export function n8nEmailPayload(input: EmailDeliveryInput): N8nEmailPayload {
  return {
    delivery_id: input.deliveryId,
    notification_id: input.notificationId,
    channel: 'email',
    recipient: input.recipient,
    subject: emailSubject(input.eventKind, input.title),
    event_kind: input.eventKind,
    booking_id: input.bookingId,
    deep_link_path: emailDeepLink(input),
  }
}

export function n8nPayloadKeys(payload: N8nEmailPayload) {
  return Object.keys(payload).sort()
}
