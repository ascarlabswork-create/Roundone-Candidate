import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { readSessionJson, writeSessionJson } from '../lib/storage.ts'
import type { BookingDraft } from '../types.ts'

const STORAGE_KEY = 'roundone.bookingDraft'

const emptyDraft: BookingDraft = {
  interviewerId: '',
  serviceId: '',
  slotId: '',
  timezone: 'Asia/Kolkata',
  paymentMethod: 'upi',
}

type BookingContextValue = {
  draft: BookingDraft
  updateDraft: (patch: Partial<BookingDraft>) => void
  resetDraft: (interviewerId?: string) => void
}

const BookingContext = createContext<BookingContextValue | null>(null)

export function BookingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(() =>
    readSessionJson<BookingDraft>(STORAGE_KEY, emptyDraft),
  )

  const value = useMemo<BookingContextValue>(
    () => ({
      draft,
      updateDraft: (patch) => {
        setDraft((current) => {
          const next = { ...current, ...patch }
          writeSessionJson(STORAGE_KEY, next)
          return next
        })
      },
      resetDraft: (interviewerId) => {
        const next = {
          ...emptyDraft,
          interviewerId: interviewerId ?? '',
          timezone: 'Asia/Kolkata',
        }
        setDraft(next)
        writeSessionJson(STORAGE_KEY, next)
      },
    }),
    [draft],
  )

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}

export function useBookingDraft() {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBookingDraft must be used within BookingProvider')
  return ctx
}
