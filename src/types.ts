import type { CandidateLevel, InterviewType, SortOption, TimeWindow } from './data/catalogs.ts'

export type Verification = {
  identity: boolean
  employment: boolean
  linkedin: boolean
}

export type AvailabilitySlot = {
  id: string
  start: string
  durationMin: number
}

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
  availability: AvailabilitySlot[]
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

export type Review = {
  id: string
  interviewerId: string
  candidateName: string
  rating: number
  date: string
  interviewType: InterviewType
  text: string
  recommend: 'yes' | 'maybe' | 'no'
  dimensions: {
    technicalExpertise: number
    communication: number
    interviewRealism: number
    feedbackQuality: number
    professionalism: number
  }
}

export type Readiness = 'Ready' | 'Almost Ready' | 'Needs More Practice'

export type FeedbackReport = {
  id: string
  bookingId: string
  interviewerId: string
  scores: {
    technicalSkills: number
    problemSolving: number
    communication: number
    systemDesign: number
    overall: number
  }
  strengths: string[]
  improvements: string[]
  overallFeedback: string
  readiness: Readiness
}

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
  serviceId: string
  slotId: string
  timezone: string
  paymentMethod: PaymentMethod
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
