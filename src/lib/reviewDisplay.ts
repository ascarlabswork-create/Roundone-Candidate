const ANONYMOUS_CANDIDATE = 'Anonymous Candidate'

export function publicReviewerName(fullName: string, showNamePublicly: boolean) {
  if (!showNamePublicly) return ANONYMOUS_CANDIDATE
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ANONYMOUS_CANDIDATE
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const initial = last[0] ? `${last[0].toUpperCase()}.` : ''
  return initial ? `${first} ${initial}` : first
}

export function roundRating(value: number) {
  return Math.round(value * 10) / 10
}
