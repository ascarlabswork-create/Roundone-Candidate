import type { CandidateLevel, InterviewType, SortOption, TimeWindow } from './data/catalogs.ts'
import type { InterviewerAvailability } from './availability/types.ts'

export type Verification = {
  identity: boolean
  employment: boolean
  linkedin: boolean
}

export type { InterviewerAvailability, BookableSlot as AvailabilitySlot } from './availability/types.ts'

export type Service = {
  id: string
  name: string
  interviewType: InterviewType
  durationMin: number
  price: number
  description: string
}

export type Interviewer = {
  id: string
  name: string
  photo: string
  currentRole: string
  company: string
  experienceYears: number
  skills: string[]
  technologies: string[]
  interviewTypes: InterviewType[]
  candidateLevels: CandidateLevel[]
  targetRoles: string[]
  rating: number
  reviewCount: number
  completedInterviews: number
  price: number
  currency: 'INR'
  services: Service[]
  availability: InterviewerAvailability
  isOnline: boolean
  verification: Verification
  bio: string
  previousCompanies: string[]
  languages: string[]
  timezone: string
}

export type Candidate = {
  id: string
  name: string
  email: string
  photo: string
  targetRole: string
  level: CandidateLevel
  targetCompany: string
  skills: string[]
}

export type BookingStatus = 'upcoming' | 'completed' | 'cancelled'

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet'

export type Booking = {
  id: string
  interviewerId: string
  candidateId: string
  serviceId: string
  serviceName: string
  interviewType: InterviewType
  durationMin: number
  sessionFee: number
  platformFee: number
  total: number
  start: string
  timezone: string
  mode: 'Video'
  status: BookingStatus
  paymentMethod: PaymentMethod
  feedbackStatus: 'pending' | 'ready' | 'none'
  createdAt: string
}

export type ReviewRecommend = 'yes' | 'maybe' | 'no'
export type ReviewModerationStatus = 'pending' | 'approved' | 'rejected'

export type ReviewDimensions = {
  technicalExpertise: number
  communication: number
  interviewRealism: number
  feedbackQuality: number
  professionalism: number
}

/** Public candidate → interviewer review. Never mixed with private scorecards. */
export type CandidateReview = {
  id: string
  bookingId: string
  interviewerId: string
  candidateId: string
  overallRating: number
  date: string
  writtenReview: string
  recommend: ReviewRecommend
  showNamePublicly: boolean
  displayName: string
  moderationStatus: ReviewModerationStatus
  dimensions: ReviewDimensions
}

/** Approved review payload for interviewer profiles and marketplace cards. */
export type PublicCandidateReview = {
  id: string
  interviewerId: string
  displayName: string
  overallRating: number
  date: string
  writtenReview: string
  dimensions: ReviewDimensions
}

export type PublicReviewSummary = {
  rating: number
  reviewCount: number
  breakdown: ReviewDimensions
}

export type Review = CandidateReview

export type ReviewDraft = {
  overallRating: number
  dimensions: ReviewDimensions
  writtenReview: string
  recommend: ReviewRecommend
  showNamePublicly: boolean
}

export type Readiness = 'Ready' | 'Almost Ready' | 'Needs More Practice'

export type InterviewerFeedbackScores = {
  technicalSkills: number
  problemSolving: number
  communication: number
  systemDesign: number
  coding: number
  behavioral: number
  overall: number
}

/** Private interviewer → candidate feedback. Never shown on public profiles. */
export type InterviewerFeedback = {
  id: string
  bookingId: string
  interviewerId: string
  candidateId: string
  scores: InterviewerFeedbackScores
  strengths: string[]
  improvements: string[]
  detailedFeedback: string
  readiness: Readiness
  internalNotes?: string
}

export type FeedbackReport = InterviewerFeedback

export type MatchingPreferences = {
  targetRole: string
  candidateLevel: string
  interviewType: string
  targetCompany: string
  skills: string[]
  preferredDate: string
  preferredTime: TimeWindow | ''
  budget: number
  language: string
  naturalLanguageQuery?: string
}

export type MatchReason = {
  key: string
  label: string
  matched: boolean
}

export type MatchBreakdown = {
  targetRole: number
  interviewType: number
  skills: number
  candidateLevel: number
  availability: number
  company: number
  price: number
  quality: number
  language: number
}

export type MatchResult = {
  interviewerId: string
  score: number
  breakdown: MatchBreakdown
  reasons: MatchReason[]
}

export type InterviewerFilters = {
  query: string
  interviewTypes: string[]
  candidateLevels: string[]
  targetRoles: string[]
  companies: string[]
  experience: string
  skills: string[]
  price: string
  rating: string
  availability: string
  languages: string[]
  verifiedOnly: boolean
  onlineOnly: boolean
  sort: SortOption
}

export type BookingDraft = {
  interviewerId: string
  interviewerProfileId: string
  serviceId: string
  slotId: string
  timezone: string
  paymentMethod: PaymentMethod
  selectedDate: string
  selectedSlot: string
  startsAtUtc: string
  endsAtUtc: string
  displayTimezone: string
  createdBookingId: string
}

export type ProgressSnapshot = {
  overall: number
  history: number[]
  metrics: {
    coding: number
    systemDesign: number
    behavioral: number
    communication: number
    problemSolving: number
  }
  recommendation: {
    title: string
    body: string
    interviewType: InterviewType
  }
}
