import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotificationList } from '../components/notifications/NotificationList.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/primitives.tsx'
import { isUnread } from '../services/notificationModel.ts'
import { NotificationError, notificationHref } from '../services/notifications.ts'
import { useNotifications } from '../state/notifications.tsx'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { items, unreadCount, status, error, refresh, markRead, markAllRead } = useNotifications()
  const [actionError, setActionError] = useState<string | null>(null)
  const hasUnread = items.some((item) => isUnread(item)) || (unreadCount != null && unreadCount > 0)

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onSelect(id: string, href: string | null) {
    setActionError(null)
    try {
      await markRead(id)
      if (href) navigate(href)
    } catch (caught) {
      const message =
        caught instanceof NotificationError ? caught.message : 'Unable to update that notification. Please try again.'
      setActionError(message)
    }
  }

  async function onMarkAll() {
    setActionError(null)
    try {
      await markAllRead()
    } catch (caught) {
      const message =
        caught instanceof NotificationError ? caught.message : 'Unable to mark notifications as read. Please try again.'
      setActionError(message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Notifications"
        subtitle="Booking updates, feedback, and reminders."
        actions={
          hasUnread ? (
            <Button variant="outline" size="sm" onClick={() => void onMarkAll()}>
              Mark all as read
            </Button>
          ) : null
        }
      />

      <div className="mt-8">
        {status === 'idle' || (status === 'loading' && items.length === 0) ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : null}

        {status === 'error' ? (
          <ErrorState
            title="Unable to load notifications"
            body={error ?? 'Please try again.'}
            onRetry={() => void refresh()}
          />
        ) : null}

        {status === 'success' && items.length === 0 ? (
          <EmptyState title="No notifications yet" body="Updates about bookings, interviews, and feedback will show up here." />
        ) : null}

        {items.length > 0 ? (
          <NotificationList items={items} onSelect={(item) => void onSelect(item.id, notificationHref(item))} />
        ) : null}

        {actionError ? <p className="mt-4 text-sm text-red-700">{actionError}</p> : null}
      </div>
    </div>
  )
}
