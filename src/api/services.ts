import { seedBookings } from '../data/bookings.ts'
import { currentCandidate } from '../data/candidate.ts'
import { feedbackReports } from '../data/feedback.ts'
import { getInterviewerById, getNextSlot, interviewers } from '../data/interviewers.ts'
import { reviews as seedReviews } from '../data/reviews.ts'
import { rankInterviewers } from '../matching/index.ts'
import { readJson, writeJson } from '../lib/storage.ts'
import type {
  Booking,
  BookingDraft,
  InterviewerFilters,
  MatchingPreferences,
  PaymentMethod,
  Review,
} from '../types.ts'
import { ApiError, delay } from './client.ts'

const BOOKINGS_KEY = 'roundone.bookings'
const REVIEWS_KEY = 'roundone.reviews'

function extraBookings() {
  return readJson<Booking[]>(BOOKINGS_KEY, [])
}

function extraReviews() {
  return readJson<Review[]>(REVIEWS_KEY, [])
}

function allBookings() {
  const extras = extraBookings()
  const extraIds = new Set(extras.map((item) => item.id))
  return [...extras, ...seedBookings.filter((item) => !extraIds.has(item.id))]
}

function allReviews() {
  return [...extraReviews(), ...seedReviews]
}

function matchesExperience(years: number, bucket: string) {
  if (!bucket) return true
  if (bucket === '0-3') return years < 3
  if (bucket === '3-6') return years >= 3 && years < 6
  if (bucket === '6-10') return years >= 6 && years < 10
  if (bucket === '10+') return years >= 10
  return true
}

function matchesPrice(price: number, bucket: string) {
  if (!bucket) return true
  if (bucket === 'under-1000') return price < 1000
  if (bucket === '1000-1500') return price >= 1000 && price <= 1500
  if (bucket === '1500-2000') return price > 1500 && price <= 2000
  if (bucket === '2000+') return price > 2000
  return true
}

function matchesAvailability(interviewerId: string, bucket: string) {
  if (!bucket) return true
  const person = getInterviewerById(interviewerId)
  if (!person) return false
  const next = getNextSlot(person)
  if (!next) return false
  const start = new Date(next.start)
  const now = new Date()
  if (bucket === 'today') {
    return start.toDateString() === now.toDateString()
  }
  if (bucket === 'week') {
    const week = new Date(now)
    week.setDate(now.getDate() + 7)
    return start <= week
  }
  if (bucket === 'weekend') {
    const day = start.getDay()
    return day === 0 || day === 6
  }
  return true
}

export async function listInterviewers(filters?: Partial<InterviewerFilters>) {
  await delay()
  const query = filters?.query?.trim().toLowerCase() ?? ''

  return interviewers.filter((person) => {
    const haystack = [
      person.name,
      person.currentRole,
      person.company,
      ...person.skills,
      ...person.technologies,
      ...person.interviewTypes,
      ...person.previousCompanies,
    ]
      .join(' ')
      .toLowerCase()

    if (query && !haystack.includes(query)) return false
    if (filters?.onlineOnly && !person.isOnline) return false
    if (filters?.verifiedOnly && !(person.verification.identity && person.verification.employment)) {
      return false
    }
    if (filters?.interviewTypes?.length && !filters.interviewTypes.some((type) => person.interviewTypes.includes(type as never))) {
      return false
    }
    if (filters?.candidateLevels?.length && !filters.candidateLevels.some((level) => person.candidateLevels.includes(level as never))) {
      return false
    }
    if (filters?.targetRoles?.length && !filters.targetRoles.some((role) => person.targetRoles.includes(role))) {
      return false
    }
    if (filters?.companies?.length && !filters.companies.includes(person.company)) return false
    if (filters?.skills?.length) {
      const pool = [...person.skills, ...person.technologies]
      if (!filters.skills.some((skill) => pool.includes(skill))) return false
    }
    if (filters?.languages?.length && !filters.languages.some((language) => person.languages.includes(language))) {
      return false
    }
    if (filters?.experience && !matchesExperience(person.experienceYears, filters.experience)) return false
    if (filters?.price && !matchesPrice(person.price, filters.price)) return false
    if (filters?.rating && person.rating < Number(filters.rating)) return false
    if (filters?.availability && !matchesAvailability(person.id, filters.availability)) return false
    return true
  })
}

export async function getInterviewer(id: string) {
  await delay()
  const person = getInterviewerById(id)
  if (!person) throw new ApiError('Interviewer not found', 404)
  return person
}

export async function getAvailability(id: string) {
  await delay()
  const person = getInterviewerById(id)
  if (!person) throw new ApiError('Interviewer not found', 404)
  return person.availability.filter((slot) => new Date(slot.start) >= new Date())
}

export async function recommendInterviewers(prefs: MatchingPreferences) {
  await delay(360)
  const ranked = rankInterviewers(interviewers, prefs)
  return ranked.map((match) => ({
    match,
    interviewer: getInterviewerById(match.interviewerId)!,
  }))
}

export async function listBookings() {
  await delay()
  return allBookings().sort((a, b) => +new Date(b.start) - +new Date(a.start))
}

export async function getBooking(id: string) {
  await delay()
  const booking = allBookings().find((item) => item.id === id)
  if (!booking) throw new ApiError('Booking not found', 404)
  return booking
}

export function platformFeeFor(sessionFee: number) {
  return Math.max(49, Math.round(sessionFee * 0.05))
}

export async function createBooking(draft: BookingDraft, paymentMethod: PaymentMethod) {
  await delay(420)
  const interviewer = getInterviewerById(draft.interviewerId)
  if (!interviewer) throw new ApiError('Interviewer not found', 404)
  const service = interviewer.services.find((item) => item.id === draft.serviceId)
  const slot = interviewer.availability.find((item) => item.id === draft.slotId)
  if (!service || !slot) throw new ApiError('Invalid booking details', 400)

  const sessionFee = service.price
  const platformFee = platformFeeFor(sessionFee)
  const booking: Booking = {
    id: `bk-${Date.now()}`,
    interviewerId: interviewer.id,
    candidateId: currentCandidate.id,
    serviceId: service.id,
    serviceName: service.name,
    interviewType: service.interviewType,
    durationMin: service.durationMin,
    sessionFee,
    platformFee,
    total: sessionFee + platformFee,
    start: slot.start,
    timezone: draft.timezone || interviewer.timezone,
    mode: 'Video',
    status: 'upcoming',
    paymentMethod,
    feedbackStatus: 'none',
    createdAt: new Date().toISOString(),
  }

  writeJson(BOOKINGS_KEY, [booking, ...extraBookings()])
  return booking
}

export async function listReviews(interviewerId: string) {
  await delay()
  return allReviews().filter((item) => item.interviewerId === interviewerId)
}

export async function submitReview(review: Omit<Review, 'id' | 'date'>) {
  await delay(360)
  const saved: Review = {
    ...review,
    id: `rev-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
  }
  writeJson(REVIEWS_KEY, [saved, ...extraReviews()])
  return saved
}

export async function getFeedback(bookingId: string) {
  await delay()
  return feedbackReports.find((item) => item.bookingId === bookingId) ?? null
}

export async function submitFeedback() {
  await delay()
  throw new ApiError('Candidate clients cannot submit interviewer feedback', 403)
}

export async function register() {
  await delay()
  return { ok: true as const, message: 'Auth is stubbed for the candidate prototype.' }
}

export { API_ENDPOINTS } from './client.ts'
