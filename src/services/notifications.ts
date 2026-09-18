import { supabase } from '../lib/supabase.ts'
import { isUuid } from '../lib/uuid.ts'
import {
  NOTIFICATIONS_TABLE,
  NOTIFICATION_PREFERENCES_TABLE,
  NOTIFICATION_LIST_LIMIT,
  NotificationError,
  mapNotificationError,
  parseCandidateNotification,
  parseNotificationPreferences,
  toPreferencePatch,
  type CandidateNotification,
  type CandidateNotificationPreferences,
  type NotificationPreferenceUpdate,
} from './notificationModel.ts'

export {
  CANDIDATE_NOTIFICATION_KINDS,
  NOTIFICATIONS_TABLE,
  NOTIFICATION_PREFERENCES_TABLE,
  NOTIFICATION_LIST_LIMIT,
  NotificationError,
  formatNotificationTime,
  isUnread,
  mapNotificationError,
  notificationHref,
  parseCandidateNotification,
  parseNotificationPreferences,
  prefersOptionalNotification,
  toPreferencePatch,
  type CandidateNotification,
  type CandidateNotificationKind,
  type CandidateNotificationPreferences,
  type NotificationErrorCode,
  type NotificationPreferenceUpdate,
} from './notificationModel.ts'

const NOTIFICATION_SELECT = 'id, kind, title, body, payload, read_at, created_at'
const PREFERENCE_SELECT = 'email_enabled, booking_updates, feedback_updates, marketing'

async function requireAuthenticatedUser(unauthenticatedMessage = 'Please sign in to view your notifications.') {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new NotificationError('unauthenticated', unauthenticatedMessage)
  }
  return data.user
}

function mapPreferenceError(error: unknown, action: 'load' | 'update') {
  const mapped = mapNotificationError(error)
  if (mapped.code === 'unauthenticated') {
    return new NotificationError('unauthenticated', 'Please sign in to manage your notification preferences.')
  }
  if (mapped.code === 'unauthorized') {
    return new NotificationError('unauthorized', 'You don’t have access to these notification preferences.')
  }
  if (mapped.code === 'network') return mapped
  return new NotificationError(
    'rpc',
    action === 'load'
      ? 'Unable to load your notification preferences. Please try again.'
      : 'Unable to update your notification preferences. Please try again.',
  )
}

export async function listMyNotifications(): Promise<CandidateNotification[]> {
  await requireAuthenticatedUser()
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select(NOTIFICATION_SELECT)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATION_LIST_LIMIT)

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

export async function markAllNotificationsRead(): Promise<void> {
  await requireAuthenticatedUser()
  const { error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .select('id')

  if (error) {
    console.error('markAllNotificationsRead failed', error)
    throw mapNotificationError(error)
  }
}

export async function getMyNotificationPreferences(): Promise<CandidateNotificationPreferences> {
  const user = await requireAuthenticatedUser('Please sign in to manage your notification preferences.')
  const { data, error } = await supabase
    .from(NOTIFICATION_PREFERENCES_TABLE)
    .select(PREFERENCE_SELECT)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('getMyNotificationPreferences failed', error)
    throw mapPreferenceError(error, 'load')
  }

  const parsed = parseNotificationPreferences(data)
  if (!parsed) {
    throw new NotificationError('rpc', 'Notification preferences were not found for this account.')
  }
  return parsed
}

export async function updateMyNotificationPreferences(
  updates: NotificationPreferenceUpdate,
): Promise<CandidateNotificationPreferences> {
  const user = await requireAuthenticatedUser('Please sign in to manage your notification preferences.')
  const patch = toPreferencePatch(updates)
  if (!patch) {
    throw new NotificationError('rpc', 'Choose a valid notification preference to update.')
  }

  const { data, error } = await supabase
    .from(NOTIFICATION_PREFERENCES_TABLE)
    .update(patch)
    .eq('profile_id', user.id)
    .select(PREFERENCE_SELECT)
    .maybeSingle()

  if (error) {
    console.error('updateMyNotificationPreferences failed', error)
    throw mapPreferenceError(error, 'update')
  }

  const parsed = parseNotificationPreferences(data)
  if (!parsed) {
    throw new NotificationError('unauthorized', 'You don’t have access to these notification preferences.')
  }
  return parsed
}
