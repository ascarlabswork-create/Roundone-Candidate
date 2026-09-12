import { BOOKINGS_STORAGE_KEY, loadAllBookings } from '../data/bookings.ts'
import { currentCandidate } from '../data/candidate.ts'
import { interviewerFeedback } from '../data/feedback.ts'
import { getInterviewerById, getNextSlot, interviewers } from '../data/interviewers.ts'
import { candidateReviews as seedReviews } from '../data/reviews.ts'
import { findBookableSlot, generateBookableSlots, groupSlotsByDate } from '../availability/index.ts'
import { rankInterviewers } from '../matching/index.ts'
import { publicReviewerName, roundRating } from '../lib/reviewDisplay.ts'
import { readJson, writeJson } from '../lib/storage.ts'
import type {
  Booking,
  BookingDraft,
  CandidateReview,
  Interviewer,
  InterviewerFeedback,
  InterviewerFilters,
  MatchingPreferences,
  PaymentMethod,
  PublicCandidateReview,
  PublicReviewSummary,
  ReviewDraft,
  ReviewDimensions,
} from '../types.ts'
import { API_ENDPOINTS, ApiError, delay } from './client.ts'

const BOOKINGS_KEY = BOOKINGS_STORAGE_KEY
const REVIEWS_KEY = 'roundone.reviews'

function extraBookings() {
  return readJson<Booking[]>(BOOKINGS_KEY, [])
}

function extraReviews() {
  return readJson<CandidateReview[]>(REVIEWS_KEY, []).filter(
    (item) => Boolean(item?.bookingId) && typeof item.overallRating === 'number' && Boolean(item.writtenReview),
  )
}

function allBookings() {
  return loadAllBookings()
}

function occupiedFor(interviewerId: string) {
  return allBookings()
    .filter((item) => item.interviewerId === interviewerId && item.status !== 'cancelled')
    .map((item) => ({
      start: item.start,
      end: new Date(new Date(item.start).getTime() + item.durationMin * 60_000).toISOString(),
    }))
}

function bookableSlotsFor(interviewer: Interviewer, serviceId: string) {
  const service = interviewer.services.find((item) => item.id === serviceId)
  if (!service) return []
  return generateBookableSlots({
    interviewerId: interviewer.id,
    availability: interviewer.availability,
    durationMin: service.durationMin,
    occupied: occupiedFor(interviewer.id),
  })
}

function myBookings() {
  return allBookings().filter((item) => item.candidateId === currentCandidate.id)
}

function allCandidateReviews() {
  const extras = extraReviews()
  const extraKeys = new Set(extras.map((item) => `${item.bookingId}:${item.candidateId}`))
  return [...extras, ...seedReviews.filter((item) => !extraKeys.has(`${item.bookingId}:${item.candidateId}`))]
}

function toPublicReview(review: CandidateReview): PublicCandidateReview {
  return {
    id: review.id,
    interviewerId: review.interviewerId,
    displayName: review.displayName,
    overallRating: review.overallRating,
    date: review.date,
    writtenReview: review.writtenReview,
    dimensions: review.dimensions,
  }
}

function approvedReviewsFor(interviewerId: string) {
  return allCandidateReviews().filter(
    (item) => item.interviewerId === interviewerId && item.moderationStatus === 'approved',
  )
}

function emptyBreakdown(): ReviewDimensions {
  return {
    technicalExpertise: 0,
    communication: 0,
    interviewRealism: 0,
    feedbackQuality: 0,
    professionalism: 0,
  }
}

function summarizePublicReviews(reviews: CandidateReview[]): PublicReviewSummary | null {
  if (!reviews.length) return null
  const count = reviews.length
  const breakdown = emptyBreakdown()
  let overall = 0
  for (const review of reviews) {
    overall += review.overallRating
    breakdown.technicalExpertise += review.dimensions.technicalExpertise
    breakdown.communication += review.dimensions.communication
    breakdown.interviewRealism += review.dimensions.interviewRealism
    breakdown.feedbackQuality += review.dimensions.feedbackQuality
    breakdown.professionalism += review.dimensions.professionalism
  }
  return {
    rating: roundRating(overall / count),
    reviewCount: count,
    breakdown: {
      technicalExpertise: roundRating(breakdown.technicalExpertise / count),
      communication: roundRating(breakdown.communication / count),
      interviewRealism: roundRating(breakdown.interviewRealism / count),
      feedbackQuality: roundRating(breakdown.feedbackQuality / count),
      professionalism: roundRating(breakdown.professionalism / count),
    },
  }
}

function withPublicReputation(person: Interviewer): Interviewer {
  const summary = summarizePublicReviews(approvedReviewsFor(person.id))
  if (!summary) return person
  return {
    ...person,
    rating: summary.rating,
    reviewCount: summary.reviewCount,
  }
}

function toPrivateFeedback(report: InterviewerFeedback): InterviewerFeedback {
  const { internalNotes: _hidden, ...safe } = report
  return safe
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

  return interviewers
    .map(withPublicReputation)
    .filter((person) => {
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
  void API_ENDPOINTS.interviewer(id)
  const person = getInterviewerById(id)
  if (!person) throw new ApiError('Interviewer not found', 404)
  return withPublicReputation(person)
}

export async function getAvailability(id: string, serviceId?: string, displayTimeZone?: string) {
  await delay()
  void API_ENDPOINTS.availability(id)
  const person = getInterviewerById(id)
  if (!person) throw new ApiError('Interviewer not found', 404)
  const service = serviceId
    ? person.services.find((item) => item.id === serviceId)
    : person.services.reduce((shortest, item) => (item.durationMin < shortest.durationMin ? item : shortest))
  if (!service) throw new ApiError('Service not found', 404)
  const slots = bookableSlotsFor(person, service.id)
  const timeZone = displayTimeZone || person.availability.timezone
  return {
    interviewerTimeZone: person.availability.timezone,
    displayTimeZone: timeZone,
    durationMin: service.durationMin,
    price: service.price,
    serviceId: service.id,
    bookingBufferMin: person.availability.bookingBufferMin,
    days: groupSlotsByDate(slots, timeZone),
  }
}

export async function recommendInterviewers(prefs: MatchingPreferences) {
  await delay(360)
  const ranked = rankInterviewers(interviewers, prefs)
  return ranked.map((match) => ({
    match,
    interviewer: withPublicReputation(getInterviewerById(match.interviewerId)!),
  }))
}

export async function listBookings() {
  await delay()
  return myBookings().sort((a, b) => +new Date(b.start) - +new Date(a.start))
}

export async function getBooking(id: string) {
  await delay()
  const booking = allBookings().find((item) => item.id === id)
  if (!booking || booking.candidateId !== currentCandidate.id) {
    throw new ApiError('Booking not found', 404)
  }
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
  if (!service) throw new ApiError('Invalid booking details', 400)

  const slots = bookableSlotsFor(interviewer, service.id)
  const slot = findBookableSlot(slots, draft.slotId)
  if (!slot) throw new ApiError('Slot no longer available', 409)

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
  void API_ENDPOINTS.interviewerReviews(interviewerId)
  return approvedReviewsFor(interviewerId).map(toPublicReview)
}

export async function getInterviewerReviewSummary(interviewerId: string) {
  await delay()
  return summarizePublicReviews(approvedReviewsFor(interviewerId))
}

export async function getBookingReview(bookingId: string) {
  await delay()
  void API_ENDPOINTS.bookingReview(bookingId)
  const booking = allBookings().find((item) => item.id === bookingId)
  if (!booking || booking.candidateId !== currentCandidate.id) {
    throw new ApiError('Booking not found', 404)
  }
  return (
    allCandidateReviews().find(
      (item) => item.bookingId === bookingId && item.candidateId === currentCandidate.id,
    ) ?? null
  )
}

export async function listMyReviews() {
  await delay()
  return allCandidateReviews().filter((item) => item.candidateId === currentCandidate.id)
}

export async function submitReview(bookingId: string, draft: ReviewDraft) {
  await delay(360)
  void API_ENDPOINTS.bookingReview(bookingId)
  const booking = allBookings().find((item) => item.id === bookingId)
  if (!booking) throw new ApiError('Booking not found', 404)
  if (booking.candidateId !== currentCandidate.id) throw new ApiError('You can only review your own sessions', 403)
  if (booking.status !== 'completed') throw new ApiError('Reviews open after the interview is completed', 403)
  const already = allCandidateReviews().some(
    (item) => item.bookingId === bookingId && item.candidateId === currentCandidate.id,
  )
  if (already) throw new ApiError('You have already reviewed this booking', 409)

  const saved: CandidateReview = {
    id: `rev-${Date.now()}`,
    bookingId,
    interviewerId: booking.interviewerId,
    candidateId: currentCandidate.id,
    overallRating: draft.overallRating,
    date: new Date().toISOString().slice(0, 10),
    writtenReview: draft.writtenReview,
    recommend: draft.recommend,
    showNamePublicly: draft.showNamePublicly,
    displayName: publicReviewerName(currentCandidate.name, draft.showNamePublicly),
    moderationStatus: 'pending',
    dimensions: draft.dimensions,
  }
  writeJson(REVIEWS_KEY, [saved, ...extraReviews()])
  return saved
}

export async function getFeedback(bookingId: string) {
  await delay()
  void API_ENDPOINTS.bookingFeedback(bookingId)
  const booking = allBookings().find((item) => item.id === bookingId)
  if (!booking || booking.candidateId !== currentCandidate.id) {
    throw new ApiError('Feedback not found', 404)
  }
  const report = interviewerFeedback.find(
    (item) => item.bookingId === bookingId && item.candidateId === currentCandidate.id,
  )
  return report ? toPrivateFeedback(report) : null
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
