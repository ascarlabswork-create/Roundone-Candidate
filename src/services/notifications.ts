import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  NOTIFICATIONS_TABLE,
  NOTIFICATION_PREFERENCES_TABLE,
  NotificationError,
  mapNotificationError,
  parseCandidateNotification,
  parseNotificationPreferences,
  type CandidateNotification,
  type CandidateNotificationPreferences,
} from './notificationModel.ts'

export {
  CANDIDATE_NOTIFICATION_KINDS,
  NOTIFICATIONS_TABLE,
  NOTIFICATION_PREFERENCES_TABLE,
  NotificationError,
  isUnread,
  mapNotificationError,
  parseCandidateNotification,
  parseNotificationPreferences,
  prefersBookingUpdates,
  type CandidateNotification,
  type CandidateNotificationKind,
  type CandidateNotificationPreferences,
  type NotificationErrorCode,
} from './notificationModel.ts'

const NOTIFICATION_SELECT = 'id, kind, title, body, payload, read_at, created_at'
const PREFERENCE_SELECT = 'email_enabled, booking_updates, feedback_updates, marketing'

async function requireAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new NotificationError('unauthenticated', 'Please sign in to view your notifications.')
  }
  return data.user
}

export async function listMyNotifications(): Promise<CandidateNotification[]> {
  await requireAuthenticatedUser()
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select(NOTIFICATION_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listMyNotifications failed', error)
    throw mapNotificationError(error)
  }

  return (data ?? [])
    .map((row) => parseCandidateNotification(row))
    .filter((row): row is CandidateNotification => row !== null)
}

export async function getUnreadNotificationCount(): Promise<number> {
  await requireAuthenticatedUser()
  const { count, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) {
    console.error('getUnreadNotificationCount failed', error)
    throw mapNotificationError(error)
  }
  return count ?? 0
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await requireAuthenticatedUser()
  if (!isUuid(notificationId)) {
    throw new NotificationError('unauthorized', 'You don’t have access to these notifications.')
  }

  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('markNotificationRead failed', error)
    throw mapNotificationError(error)
  }
  if (!data) {
    throw new NotificationError('unauthorized', 'You don’t have access to these notifications.')
  }
}

export async function getMyNotificationPreferences(): Promise<CandidateNotificationPreferences> {
  await requireAuthenticatedUser()
  const { data, error } = await supabase
    .from(NOTIFICATION_PREFERENCES_TABLE)
    .select(PREFERENCE_SELECT)
    .maybeSingle()

  if (error) {
    console.error('getMyNotificationPreferences failed', error)
    throw mapNotificationError(error)
  }

  const parsed = parseNotificationPreferences(data)
  if (!parsed) {
    return {
      emailEnabled: true,
      bookingUpdates: true,
      feedbackUpdates: true,
      marketing: false,
    }
  }
  return parsed
}
