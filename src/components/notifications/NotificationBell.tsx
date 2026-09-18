import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NotificationError, notificationHref } from '../../services/notifications.ts'
import { useNotifications } from '../../state/notifications.tsx'
import { Button } from '../ui/Button.tsx'
import { Skeleton } from '../ui/primitives.tsx'
import { NotificationList } from './NotificationList.tsx'

export function NotificationBell() {
  const navigate = useNavigate()
  const { items, unreadCount, status, error, refresh, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const badge = unreadCount != null && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null

  useEffect(() => {
    if (!open) return
    setActionError(null)
    void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function onSelect(id: string, href: string | null) {
    setActionError(null)
    try {
      await markRead(id)
      setOpen(false)
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
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-50"
        aria-label={badge ? `Notifications, ${badge} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {badge ? (
          <span className="absolute right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-4 text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-navy-950">Notifications</h2>
            {unreadCount != null && unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
                onClick={() => void onMarkAll()}
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {(status === 'idle' || status === 'loading') && items.length === 0 ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : null}
            {status === 'error' ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-red-700">{error ?? 'Unable to load notifications. Please try again.'}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => void refresh()}>
                  Try again
                </Button>
              </div>
            ) : null}
            {status === 'success' && items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-600">No notifications yet</p>
            ) : null}
            {items.length > 0 ? (
              <NotificationList
                items={items}
                compact
                onSelect={(item) => void onSelect(item.id, notificationHref(item))}
              />
            ) : null}
          </div>

          {actionError ? <p className="border-t border-slate-100 px-4 py-2 text-xs text-red-700">{actionError}</p> : null}

          <div className="border-t border-slate-100 px-4 py-2">
            <Link
              to="/candidate/notifications"
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
