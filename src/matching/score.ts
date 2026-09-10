import { hoursForWindow, sameDay } from '../lib/dates.ts'
import { getNextSlot, isVerified, lowestServicePrice } from '../data/interviewers.ts'
import type {
  Interviewer,
  MatchBreakdown,
  MatchingPreferences,
  MatchReason,
  MatchResult,
} from '../types.ts'
import { MATCH_WEIGHTS } from './weights.ts'

function norm(value: string) {
  return value.trim().toLowerCase()
}

function includesLoose(haystack: string, needle: string) {
  const h = norm(haystack)
  const n = norm(needle)
  return h.includes(n) || n.includes(h)
}

const RELATED_ROLES: Record<string, string[]> = {
  'software engineer': ['backend engineer', 'frontend engineer', 'full stack engineer', 'sde'],
  'backend engineer': ['software engineer', 'full stack engineer'],
  'frontend engineer': ['software engineer', 'full stack engineer'],
  'full stack engineer': ['software engineer', 'frontend engineer', 'backend engineer'],
  'ml engineer': ['software engineer', 'data scientist'],
  'data scientist': ['ml engineer'],
  'engineering manager': ['software engineer'],
}

function roleScore(interviewer: Interviewer, role: string) {
  if (!role) return 0.5
  if (interviewer.targetRoles.some((item) => norm(item) === norm(role))) return 1
  if (includesLoose(interviewer.currentRole, role)) return 0.75
  const related = RELATED_ROLES[norm(role)] ?? []
  if (
    related.some(
      (item) =>
        interviewer.targetRoles.some((roleName) => norm(roleName) === item) ||
        includesLoose(interviewer.currentRole, item),
    )
  ) {
    return 0.6
  }
  return 0
}

function interviewTypeScore(interviewer: Interviewer, interviewType: string) {
  if (!interviewType) return 0.5
  return interviewer.interviewTypes.some((item) => norm(item) === norm(interviewType)) ? 1 : 0
}

function skillsScore(interviewer: Interviewer, skills: string[]) {
  if (!skills.length) return 0.5
  const pool = [...interviewer.skills, ...interviewer.technologies].map(norm)
  const hits = skills.filter((skill) => pool.some((item) => item === norm(skill) || item.includes(norm(skill))))
  return hits.length / skills.length
}

function levelScore(interviewer: Interviewer, level: string) {
  if (!level) return 0.5
  return interviewer.candidateLevels.some((item) => norm(item) === norm(level)) ? 1 : 0
}

function availabilityScore(interviewer: Interviewer, prefs: MatchingPreferences) {
  const slots = interviewer.availability.map((item) => new Date(item.start))
  if (!slots.length) return 0
  if (!prefs.preferredDate) return getNextSlot(interviewer) ? 0.6 : 0.15

  const [year, month, day] = prefs.preferredDate.split('-').map(Number)
  const preferred = new Date(year, (month ?? 1) - 1, day ?? 1)
  const window = hoursForWindow(prefs.preferredTime)

  const exact = slots.some((slot) => {
    if (!sameDay(slot, preferred)) return false
    if (!window) return true
    const hour = slot.getHours() + slot.getMinutes() / 60
    return hour >= window.start && hour < window.end
  })
  if (exact) return 1

  const same = slots.some((slot) => sameDay(slot, preferred))
  if (same) return 0.7

  const nearby = slots.some((slot) => {
    const diff = Math.abs(slot.getTime() - preferred.getTime())
    return diff <= 2 * 24 * 60 * 60 * 1000
  })
  if (nearby) return 0.4

  return 0.15
}

function companyScore(interviewer: Interviewer, company: string) {
  if (!company) return 0.5
  if (norm(interviewer.company) === norm(company)) return 1
  if (interviewer.previousCompanies.some((item) => norm(item) === norm(company))) return 0.7
  return 0.2
}

function priceScore(interviewer: Interviewer, budget: number) {
  if (!budget) return 0.5
  const price = lowestServicePrice(interviewer)
  if (price <= budget) return 1
  if (price <= budget * 1.2) return 0.5
  return 0
}

function qualityScore(interviewer: Interviewer) {
  const ratingPart = interviewer.rating / 5
  const volumePart = Math.min(interviewer.completedInterviews / 400, 1)
  const verificationCount =
    Number(interviewer.verification.identity) +
    Number(interviewer.verification.employment) +
    Number(interviewer.verification.linkedin)
  const verificationPart = verificationCount / 3
  return ratingPart * 0.5 + volumePart * 0.3 + verificationPart * 0.2
}

function languageScore(interviewer: Interviewer, language: string) {
  if (!language) return 1
  return interviewer.languages.some((item) => norm(item) === norm(language)) ? 1 : 0
}

export function buildReasons(breakdown: MatchBreakdown): MatchReason[] {
  return [
    { key: 'type', label: 'Interview type match', matched: breakdown.interviewType >= 1 },
    {
      key: 'role-level',
      label: 'Role/level match',
      matched: breakdown.targetRole >= 0.6 && breakdown.candidateLevel >= 1,
    },
    { key: 'skills', label: 'Relevant skills', matched: breakdown.skills >= 0.5 },
    { key: 'company', label: 'Company/domain experience', matched: breakdown.company >= 0.7 },
    { key: 'availability', label: 'Availability match', matched: breakdown.availability >= 0.7 },
    { key: 'budget', label: 'Budget compatibility', matched: breakdown.price >= 1 },
  ]
}

export function scoreInterviewer(interviewer: Interviewer, prefs: MatchingPreferences): MatchResult {
  const breakdown: MatchBreakdown = {
    targetRole: roleScore(interviewer, prefs.targetRole),
    interviewType: interviewTypeScore(interviewer, prefs.interviewType),
    skills: skillsScore(interviewer, prefs.skills),
    candidateLevel: levelScore(interviewer, prefs.candidateLevel),
    availability: availabilityScore(interviewer, prefs),
    company: companyScore(interviewer, prefs.targetCompany),
    price: priceScore(interviewer, prefs.budget),
    quality: qualityScore(interviewer),
    language: languageScore(interviewer, prefs.language),
  }

  const weighted =
    breakdown.targetRole * MATCH_WEIGHTS.targetRole +
    breakdown.interviewType * MATCH_WEIGHTS.interviewType +
    breakdown.skills * MATCH_WEIGHTS.skills +
    breakdown.candidateLevel * MATCH_WEIGHTS.candidateLevel +
    breakdown.availability * MATCH_WEIGHTS.availability +
    breakdown.company * MATCH_WEIGHTS.company +
    breakdown.price * MATCH_WEIGHTS.price +
    breakdown.quality * MATCH_WEIGHTS.quality +
    breakdown.language * MATCH_WEIGHTS.language

  return {
    interviewerId: interviewer.id,
    score: Math.round(weighted * 100),
    breakdown,
    reasons: buildReasons(breakdown),
  }
}

export function rankInterviewers(interviewers: Interviewer[], prefs: MatchingPreferences) {
  return interviewers
    .map((person) => scoreInterviewer(person, prefs))
    .sort((a, b) => b.score - a.score)
}

export function hasMeaningfulPreferences(prefs: MatchingPreferences | null) {
  if (!prefs) return false
  return Boolean(
    prefs.targetRole ||
      prefs.candidateLevel ||
      prefs.interviewType ||
      prefs.targetCompany ||
      prefs.skills.length ||
      prefs.preferredDate ||
      prefs.budget,
  )
}

export { isVerified }
