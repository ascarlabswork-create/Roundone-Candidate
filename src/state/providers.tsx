import type { ReactNode } from 'react'
import { BookingProvider } from './booking.tsx'
import { MatchingProvider } from './matching.tsx'
import { SavedProvider } from './saved.tsx'
import { SessionProvider } from './session.tsx'
import { ToastProvider } from './toast.tsx'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <MatchingProvider>
        <BookingProvider>
          <SavedProvider>
            <ToastProvider>{children}</ToastProvider>
          </SavedProvider>
        </BookingProvider>
      </MatchingProvider>
    </SessionProvider>
  )
}
