import type { ReactNode } from 'react'
import { BookingProvider } from './booking.tsx'
import { MatchingProvider } from './matching.tsx'
import { NotificationsProvider } from './notifications.tsx'
import { SavedProvider } from './saved.tsx'
import { SessionProvider } from './session.tsx'
import { ToastProvider } from './toast.tsx'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <NotificationsProvider>
        <MatchingProvider>
          <BookingProvider>
            <SavedProvider>
              <ToastProvider>{children}</ToastProvider>
            </SavedProvider>
          </BookingProvider>
        </MatchingProvider>
      </NotificationsProvider>
    </SessionProvider>
  )
}
