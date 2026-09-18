import { asRecord, readBoolean, readString } from '../lib/rows.ts'
import { isUuid } from '../lib/uuid.ts'

export const NOTIFICATION_LIST_LIMIT = 50

export const NOTIFICATIONS_TABLE = 'notifications'
export const NOTIFICATION_PREFERENCES_TABLE = 'notification_preferences'

export const CANDIDATE_NOTIFICATION_KINDS = [
  'booking_requested',
  'booking_confirmed',
  'booking_rejected',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_expired',
  'interview_completed',
  'interview_reminder',
  'feedback_ready',
] as const

export type CandidateNotificationKind = (typeof CANDIDATE_NOTIFICATION_KINDS)[number]

export type NotificationErrorCode = 'unauthenticated' | 'unauthorized' | 'network' | 'rpc'

export class NotificationError extends Error {
  readonly code: NotificationErrorCode

  constructor(code: NotificationErrorCode, message: string) {
    super(message)
    this.name = 'NotificationError'
    this.code = code
  }
}

export type CandidateNotification = {
  id: string
  kind: string
  title: string
  body: string
  bookingId: string | null
  readAt: string | null
  createdAt: string
}

export type CandidateNotificationPreferences = {
  emailEnabled: boolean
  bookingUpdates: boolean
  feedbackUpdates: boolean
  marketing: boolean
}

function isNotificationKind(value: string): value is CandidateNotificationKind {
  return (CANDIDATE_NOTIFICATION_KINDS as readonly string[]).includes(value)
}

function errorText(error: unknown) {
  if (!error || typeof error !== 'object') return typeof error === 'string' ? error.toLowerCase() : ''
  const record = error as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message : ''
  const details = typeof record.details === 'string' ? record.details : ''
  const code = typeof record.code === 'string' ? record.code : ''
  return `${code} ${message} ${details}`.toLowerCase()
}

function isNetworkFailure(error: unknown) {
  if (error instanceof TypeError) return true
  const text = errorText(error)
  const message = error instanceof Error ? error.message : ''
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(`${text} ${message}`)
}

export function mapNotificationError(error: unknown): NotificationError {
  if (error instanceof NotificationError) return error
  if (isNetworkFailure(error)) {
    return new NotificationError('network', 'Unable to reach notifications. Check your connection.')
  }
  const text = errorText(error)
  if (text.includes('42501') || text.includes('not_authorized') || text.includes('row-level security')) {
    return new NotificationError('unauthorized', 'You don’t have access to these notifications.')
  }
  return new NotificationError('rpc', 'Unable to load notifications. Please try again.')
}

function readPayloadBookingId(payload: unknown): string | null {
  const record = asRecord(payload)
  if (!record) return null
  return readString(record, 'booking_id')
}

export function parseCandidateNotification(value: unknown): CandidateNotification | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  const id = readString(row, 'id')
  const kind = readString(row, 'kind')
  const title = readString(row, 'title')
  const body = readString(row, 'body')
  const createdAt = readString(row, 'created_at')
  if (!id || !kind || !title || !body || !createdAt) return null
  return {
    id,
    kind,
    title,
    body,
    bookingId: readPayloadBookingId(row.payload),
    readAt: readString(row, 'read_at'),
    createdAt,
  }
}

export function parseNotificationPreferences(value: unknown): CandidateNotificationPreferences | null {
  const row = Array.isArray(value) ? asRecord(value[0]) : asRecord(value)
  if (!row) return null
  return {
    emailEnabled: readBoolean(row, 'email_enabled') ?? true,
    bookingUpdates: readBoolean(row, 'booking_updates') ?? true,
    feedbackUpdates: readBoolean(row, 'feedback_updates') ?? true,
    marketing: readBoolean(row, 'marketing') ?? false,
  }
}

export function isUnread(notification: CandidateNotification) {
  return notification.readAt == null
}

export function notificationHref(notification: CandidateNotification): string | null {
  const bookingId = notification.bookingId
  if (!bookingId || !isUuid(bookingId)) return null

  if (notification.kind === 'feedback_ready' || notification.kind === 'interview_completed') {
    return `/candidate/feedback/${bookingId}`
  }
  if (notification.kind === 'booking_confirmed' || notification.kind === 'interview_reminder') {
    return `/candidate/interview/${bookingId}`
  }
  if (
    notification.kind === 'booking_requested' ||
    notification.kind === 'booking_rejected' ||
    notification.kind === 'booking_cancelled' ||
    notification.kind === 'booking_rescheduled' ||
    notification.kind === 'booking_expired'
  ) {
    return '/candidate/interviews'
  }
  return '/candidate/interviews'
}

export function formatNotificationTime(iso: string, nowMs = Date.now()) {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const deltaMs = Math.max(0, nowMs - then)
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hrs ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function prefersBookingUpdates(prefs: CandidateNotificationPreferences, kind: string) {
  if (!isNotificationKind(kind)) return true
  if (kind === 'feedback_ready') return prefs.feedbackUpdates
  return prefs.bookingUpdates
}
