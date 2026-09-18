import type { MatchingPreferences } from '../types.ts'
import type { MatchingCatalogPerson } from './catalog.ts'

export const MATCHING_AI_FUNCTION = 'assist-matching'
export const MATCHING_AI_CANDIDATE_LIMIT = 8
export const MATCHING_AI_TIMEOUT_MS = 8_000
export const DETERMINISTIC_RANK_WEIGHT = 0.85
export const AI_RELEVANCE_WEIGHT = 0.15

export const BANNED_MATCH_CLAIM =
  /\b(guaranteed|perfect match|best interviewer|definitely (help you )?get hired|will get you hired)\b/i

export type MatchingAiPreferences = {
  targetRole: string
  candidateLevel: string
  skills: string[]
  interviewType: string
  targetCompany: string
  language: string
  budget: number
  intent: string
}

export type MatchingAiServiceInput = {
  id: string
  name: string
  interviewType: string
  durationMin: number
  pricePaise: number
  description: string
}

export type MatchingAiCandidateInput = {
  interviewerId: string
  name: string
  currentRole: string
  company: string
  headline: string
  skills: string[]
  targetRoles: string[]
  candidateLevels: string[]
  languages: string[]
  ratingAvg: number | null
  reviewCount: number
  completedInterviews: number
  services: MatchingAiServiceInput[]
}

export type MatchingAiMatch = {
  serviceId: string
  relevanceScore: number
  matchedFactors: string[]
  explanation: string
}

export type MatchingAiNormalized = {
  targetRole: string
  candidateLevel: string
  skills: string[]
  interviewType: string
  domainPreference: string
}

export type MatchingAiResponse = {
  normalized: MatchingAiNormalized | null
  matches: MatchingAiMatch[]
}

export type MatchingAiRequest = {
  preferences: MatchingAiPreferences
  candidates: MatchingAiCandidateInput[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readTrimmed(value: unknown, max = 160) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function readScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > 1) return null
  return value
}

function uniqueStrings(values: unknown, maxItems = 8, maxLen = 40) {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const item of values) {
    const text = readTrimmed(item, maxLen)
    if (!text) continue
    if (result.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue
    result.push(text)
    if (result.length >= maxItems) break
  }
  return result
}

export function toAiPreferences(prefs: MatchingPreferences): MatchingAiPreferences {
  return {
    targetRole: prefs.targetRole.trim().slice(0, 80),
    candidateLevel: prefs.candidateLevel.trim().slice(0, 40),
    skills: prefs.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 12),
    interviewType: prefs.interviewType.trim().slice(0, 60),
    targetCompany: prefs.targetCompany.trim().slice(0, 80),
    language: prefs.language.trim().slice(0, 40),
    budget: Number.isFinite(prefs.budget) ? Math.max(0, Math.round(prefs.budget)) : 0,
    intent: (prefs.naturalLanguageQuery ?? '').trim().slice(0, 280),
  }
}

export function toAiCandidate(person: MatchingCatalogPerson): MatchingAiCandidateInput {
  return {
    interviewerId: person.id,
    name: person.name,
    currentRole: person.currentRole,
    company: person.company,
    headline: (person.headline ?? '').slice(0, 120),
    skills: person.skills.slice(0, 12),
    targetRoles: person.targetRoles.slice(0, 8),
    candidateLevels: person.candidateLevels.slice(0, 8),
    languages: person.languages.slice(0, 6),
    ratingAvg: person.rating || null,
    reviewCount: person.reviewCount,
    completedInterviews: person.completedInterviews,
    services: person.services.slice(0, 4).map((service) => ({
      id: service.id,
      name: service.name,
      interviewType: service.interviewType,
      durationMin: service.durationMin,
      pricePaise: Math.round(service.price * 100),
      description: service.description.slice(0, 180),
    })),
  }
}

export function allowedFactorPool(prefs: MatchingAiPreferences, candidates: MatchingAiCandidateInput[]) {
  const pool = new Set<string>()
  const add = (value: string) => {
    const trimmed = value.trim()
    if (trimmed) pool.add(trimmed.toLowerCase())
  }
  add(prefs.targetRole)
  add(prefs.candidateLevel)
  add(prefs.interviewType)
  add(prefs.targetCompany)
  add(prefs.language)
  add(prefs.intent)
  for (const skill of prefs.skills) add(skill)
  for (const person of candidates) {
    add(person.currentRole)
    add(person.company)
    add(person.headline)
    person.skills.forEach(add)
    person.targetRoles.forEach(add)
    person.candidateLevels.forEach(add)
    person.languages.forEach(add)
    for (const service of person.services) {
      add(service.name)
      add(service.interviewType)
      add(service.description)
    }
  }
  return pool
}

function factorAllowed(factor: string, pool: Set<string>) {
  const needle = factor.toLowerCase()
  if (pool.has(needle)) return true
  for (const item of pool) {
    if (item.includes(needle) || needle.includes(item)) return true
  }
  return false
}

export function parseMatchingAiResponse(
  value: unknown,
  allowedServiceIds: Set<string>,
  factorPool: Set<string>,
): MatchingAiResponse | null {
  const row = asRecord(value)
  if (!row) return null
  const matchesRaw = Array.isArray(row.matches) ? row.matches : []
  const matches: MatchingAiMatch[] = []
  for (const item of matchesRaw) {
    const parsed = asRecord(item)
    if (!parsed) continue
    const serviceId = readTrimmed(parsed.service_id ?? parsed.serviceId, 80)
    const relevanceScore = readScore(parsed.relevance_score ?? parsed.relevanceScore)
    const explanation = readTrimmed(parsed.explanation, 180)
    if (!allowedServiceIds.has(serviceId) || relevanceScore == null || !explanation) continue
    if (BANNED_MATCH_CLAIM.test(explanation)) continue
    const matchedFactors = uniqueStrings(parsed.matched_factors ?? parsed.matchedFactors, 6, 40).filter((factor) =>
      factorAllowed(factor, factorPool),
    )
    if (matches.some((existing) => existing.serviceId === serviceId)) continue
    matches.push({ serviceId, relevanceScore, matchedFactors, explanation })
    if (matches.length >= MATCHING_AI_CANDIDATE_LIMIT) break
  }

  const normalizedRow = asRecord(row.normalized)
  const normalized = normalizedRow
    ? {
        targetRole: readTrimmed(normalizedRow.target_role ?? normalizedRow.targetRole, 80),
        candidateLevel: readTrimmed(normalizedRow.candidate_level ?? normalizedRow.candidateLevel, 40),
        skills: uniqueStrings(normalizedRow.skills, 8, 40),
        interviewType: readTrimmed(normalizedRow.interview_type ?? normalizedRow.interviewType, 60),
        domainPreference: readTrimmed(normalizedRow.domain_preference ?? normalizedRow.domainPreference, 80),
      }
    : null

  return { normalized, matches }
}

export function mergeNormalizedPreferences(
  prefs: MatchingPreferences,
  normalized: MatchingAiNormalized | null,
): MatchingPreferences {
  if (!normalized) return prefs
  const skills = [...prefs.skills]
  for (const skill of normalized.skills) {
    if (!skills.some((item) => item.toLowerCase() === skill.toLowerCase())) skills.push(skill)
  }
  return {
    ...prefs,
    targetRole: prefs.targetRole.trim() || normalized.targetRole,
    candidateLevel: prefs.candidateLevel.trim() || normalized.candidateLevel,
    interviewType: prefs.interviewType.trim() || normalized.interviewType,
    skills,
  }
}

export function combineMatchScore(deterministicScore: number, aiRelevance: number | null) {
  if (aiRelevance == null) return deterministicScore
  return Math.round(deterministicScore * DETERMINISTIC_RANK_WEIGHT + aiRelevance * 100 * AI_RELEVANCE_WEIGHT)
}

export function looksLikeNaturalLanguage(query: string) {
  const text = query.trim()
  if (text.length < 24) return false
  return text.split(/\s+/).filter(Boolean).length >= 6
}
