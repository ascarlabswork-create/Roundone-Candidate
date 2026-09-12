import { addCivilDays, isoDateInZone, wallTimeInZoneToUtc, weekdayOfCivilDate } from '../availability/timezone.ts'
import { addDays } from '../lib/dates.ts'
import { readJson } from '../lib/storage.ts'
import type { Booking } from '../types.ts'
import { currentCandidate } from './candidate.ts'

export const BOOKINGS_STORAGE_KEY = 'roundone.bookings'

function atHour(daysFromToday: number, hour: number, minute = 0) {
  const date = addDays(new Date(), daysFromToday)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function nextWeekdayWallTime(day: ReturnType<typeof weekdayOfCivilDate>, timeHHMM: string, timeZone: string) {
  const today = isoDateInZone(new Date(), timeZone)
  for (let offset = 0; offset < 14; offset += 1) {
    const date = addCivilDays(today, offset)
    if (weekdayOfCivilDate(date) !== day) continue
    const start = wallTimeInZoneToUtc(date, timeHHMM, timeZone)
    if (start.getTime() > Date.now() + 60 * 60_000) return start.toISOString()
  }
  return wallTimeInZoneToUtc(addCivilDays(today, 7), timeHHMM, timeZone).toISOString()
}

export function loadAllBookings() {
  const extras = readJson<Booking[]>(BOOKINGS_STORAGE_KEY, [])
  const extraIds = new Set(extras.map((item) => item.id))
  return [...extras, ...seedBookings.filter((item) => !extraIds.has(item.id))]
}

export const seedBookings: Booking[] = [
  {
    id: 'bk-completed-rahul',
    interviewerId: 'rahul-sharma',
    candidateId: currentCandidate.id,
    serviceId: 'rahul-sysdesign',
    serviceName: 'System Design Mock',
    interviewType: 'System Design',
    durationMin: 60,
    sessionFee: 1500,
    platformFee: 75,
    total: 1575,
    start: atHour(-5, 18),
    timezone: 'Asia/Kolkata',
    mode: 'Video',
    status: 'completed',
    paymentMethod: 'upi',
    feedbackStatus: 'ready',
    createdAt: atHour(-8, 11),
  },
  {
    id: 'bk-upcoming-rahul',
    interviewerId: 'rahul-sharma',
    candidateId: currentCandidate.id,
    serviceId: 'rahul-sysdesign',
    serviceName: 'System Design Mock',
    interviewType: 'System Design',
    durationMin: 60,
    sessionFee: 1500,
    platformFee: 75,
    total: 1575,
    start: nextWeekdayWallTime('Saturday', '11:00', 'Asia/Kolkata'),
    timezone: 'Asia/Kolkata',
    mode: 'Video',
    status: 'upcoming',
    paymentMethod: 'upi',
    feedbackStatus: 'none',
    createdAt: atHour(-2, 11),
  },
  {
    id: 'bk-upcoming-fatima',
    interviewerId: 'fatima-khan',
    candidateId: currentCandidate.id,
    serviceId: 'fatima-coding',
    serviceName: 'Frontend Coding Mock',
    interviewType: 'Coding',
    durationMin: 60,
    sessionFee: 1300,
    platformFee: 65,
    total: 1365,
    start: atHour(8, 20),
    timezone: 'Asia/Kolkata',
    mode: 'Video',
    status: 'upcoming',
    paymentMethod: 'card',
    feedbackStatus: 'none',
    createdAt: atHour(-1, 16),
  },
  {
    id: 'bk-completed-marcus',
    interviewerId: 'marcus-chen',
    candidateId: currentCandidate.id,
    serviceId: 'marcus-sysdesign',
    serviceName: 'System Design Mock',
    interviewType: 'System Design',
    durationMin: 60,
    sessionFee: 1800,
    platformFee: 90,
    total: 1890,
    start: atHour(-12, 18, 30),
    timezone: 'Asia/Kolkata',
    mode: 'Video',
    status: 'completed',
    paymentMethod: 'upi',
    feedbackStatus: 'ready',
    createdAt: atHour(-20, 10),
  },
  {
    id: 'bk-completed-david',
    interviewerId: 'david-kim',
    candidateId: currentCandidate.id,
    serviceId: 'david-coding',
    serviceName: 'Coding Mock',
    interviewType: 'Coding',
    durationMin: 60,
    sessionFee: 1100,
    platformFee: 55,
    total: 1155,
    start: atHour(-28, 21),
    timezone: 'Asia/Kolkata',
    mode: 'Video',
    status: 'completed',
    paymentMethod: 'netbanking',
    feedbackStatus: 'ready',
    createdAt: atHour(-35, 9),
  },
  {
    id: 'bk-completed-ananya',
    interviewerId: 'ananya-rao',
    candidateId: currentCandidate.id,
    serviceId: 'ananya-behavioral',
    serviceName: 'Behavioral Mock',
    interviewType: 'Behavioral',
    durationMin: 45,
    sessionFee: 1200,
    platformFee: 60,
    total: 1260,
    start: atHour(-40, 20),
    timezone: 'Asia/Kolkata',
    mode: 'Video',
    status: 'completed',
    paymentMethod: 'wallet',
    feedbackStatus: 'ready',
    createdAt: atHour(-45, 14),
  },
  {
    id: 'bk-cancelled-priya',
    interviewerId: 'priya-nair',
    candidateId: currentCandidate.id,
    serviceId: 'priya-product',
    serviceName: 'Product Sense Mock',
    interviewType: 'Product',
    durationMin: 45,
    sessionFee: 1700,
    platformFee: 85,
    total: 1785,
    start: atHour(-6, 19),
    timezone: 'Asia/Kolkata',
    mode: 'Video',
    status: 'cancelled',
    paymentMethod: 'upi',
    feedbackStatus: 'none',
    createdAt: atHour(-10, 12),
  },
]
