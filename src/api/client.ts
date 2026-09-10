export const API_ENDPOINTS = {
  register: '/api/auth/register',
  interviewers: '/api/interviewers',
  interviewer: (id: string) => `/api/interviewers/${id}`,
  recommendations: '/api/matching/recommendations',
  availability: (id: string) => `/api/interviewers/${id}/availability`,
  bookings: '/api/bookings',
  bookingFeedback: (id: string) => `/api/bookings/${id}/feedback`,
  bookingReview: (id: string) => `/api/bookings/${id}/review`,
} as const

const DEFAULT_DELAY = 280

export function delay(ms = DEFAULT_DELAY) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
