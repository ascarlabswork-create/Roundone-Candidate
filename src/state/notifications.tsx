import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  mapNotificationError,
  type CandidateNotification,
} from '../services/notifications.ts'
import { isUnread } from '../services/notificationModel.ts'
import { useSession } from './session.tsx'

type NotificationsStatus = 'idle' | 'loading' | 'success' | 'error'

type NotificationsContextValue = {
  items: CandidateNotification[]
  unreadCount: number | null
  status: NotificationsStatus
  error: string | null
  refresh: () => Promise<void>
  refreshUnread: () => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const UNREAD_REFRESH_MS = 60_000

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession()
  const [items, setItems] = useState<CandidateNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [status, setStatus] = useState<NotificationsStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const refreshUnread = useCallback(async () => {
    if (sessionStatus !== 'authenticated') {
      setUnreadCount(null)
      return
    }
    try {
      const count = await getUnreadNotificationCount()
      setUnreadCount(count)
    } catch (caught) {
      console.error('refreshUnread failed', caught)
    }
  }, [sessionStatus])

  const refresh = useCallback(async () => {
    if (sessionStatus !== 'authenticated') {
      setItems([])
      setUnreadCount(null)
      setStatus('idle')
      setError(null)
      return
    }

    setStatus('loading')
    setError(null)
    try {
      const [nextItems, count] = await Promise.all([listMyNotifications(), getUnreadNotificationCount()])
      setItems(nextItems)
      setUnreadCount(count)
      setStatus('success')
    } catch (caught) {
      const mapped = mapNotificationError(caught, 'load')
      setStatus('error')
      setError(mapped.message)
    }
  }, [sessionStatus])

  const markRead = useCallback(
    async (notificationId: string) => {
      const current = items.find((item) => item.id === notificationId)
      if (current && !isUnread(current)) return
      await markNotificationRead(notificationId)
      await refresh()
    },
    [items, refresh],
  )

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    await refresh()
  }, [refresh])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      setItems([])
      setUnreadCount(null)
      setStatus('idle')
      setError(null)
      return
    }
    void refreshUnread()
  }, [sessionStatus, refreshUnread])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    function onFocus() {
      void refreshUnread()
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') void refreshUnread()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnread()
    }, UNREAD_REFRESH_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [sessionStatus, refreshUnread])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount,
      status,
      error,
      refresh,
      refreshUnread,
      markRead,
      markAllRead,
    }),
    [items, unreadCount, status, error, refresh, refreshUnread, markRead, markAllRead],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
