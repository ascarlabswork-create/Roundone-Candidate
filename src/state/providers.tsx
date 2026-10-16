import type { ReactNode } from 'react'
import { CookieConsentUI } from '../components/consent/CookieConsentUI.tsx'
import { BookingProvider } from './booking.tsx'
import { CookieConsentProvider } from './cookieConsent.tsx'
import { MatchingProvider } from './matching.tsx'
import { NotificationsProvider } from './notifications.tsx'
import { SavedProvider } from './saved.tsx'
import { SessionProvider } from './session.tsx'
import { ToastProvider } from './toast.tsx'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CookieConsentProvider>
      <SessionProvider>
        <NotificationsProvider>
          <MatchingProvider>
            <BookingProvider>
              <SavedProvider>
                <ToastProvider>
                  {children}
                  <CookieConsentUI />
                </ToastProvider>
              </SavedProvider>
            </BookingProvider>
          </MatchingProvider>
        </NotificationsProvider>
      </SessionProvider>
    </CookieConsentProvider>
  )
}
