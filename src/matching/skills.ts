import type { SkillMatchDetail } from '../types.ts'
import { canonicalizeSkill, normalizeSkill } from './skillCanonical.ts'

export { normalizeSkill } from './skillCanonical.ts'

/**
 * Keep the candidate's own wording. Later aliases of the same canonical skill are dropped.
 * Does not rewrite stored text and does not touch anyone else's skills.
 */
export function uniqueCandidateSkillWording(skills: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of skills) {
    const wording = raw.trim().replace(/\s+/g, ' ')
    const canonical = canonicalizeSkill(wording)
    if (!canonical || seen.has(canonical.key)) continue
    seen.add(canonical.key)
    out.push(wording)
  }
  return out
}

/** True when `next` is the same canonical skill as another row. `ignore` is the row being edited. */
export function isCanonicalSkillDuplicate(skills: string[], next: string, ignore?: string): boolean {
  const canonical = canonicalizeSkill(next)
  if (!canonical) return false
  return skills.some((skill) => {
    if (ignore !== undefined && skill === ignore) return false
    return canonicalizeSkill(skill)?.key === canonical.key
  })
}

/** Deduplicate by canonical skill, keeping the canonical display label. */
export function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of skills) {
    const canonical = canonicalizeSkill(raw)
    if (!canonical || seen.has(canonical.key)) continue
    seen.add(canonical.key)
    out.push(canonical.display)
  }
  return out
}

export function compareSkillSets(
  candidateSkills: string[],
  interviewerSkills: string[],
): SkillMatchDetail {
  const candidate = dedupeSkills(candidateSkills)
  const interviewer = dedupeSkills(interviewerSkills)
  const interviewerByNorm = new Map(interviewer.map((skill) => [normalizeSkill(skill), skill]))
  const candidateNorms = new Set(candidate.map((skill) => normalizeSkill(skill)))

  const matchedSkills = candidate.filter((skill) => interviewerByNorm.has(normalizeSkill(skill)))
  const candidateMissingSkills = candidate.filter(
    (skill) => !interviewerByNorm.has(normalizeSkill(skill)),
  )
  const interviewerExtraSkills = interviewer.filter(
    (skill) => !candidateNorms.has(normalizeSkill(skill)),
  )

  if (candidate.length === 0) {
    return {
      matchedSkills: [],
      candidateMissingSkills: [],
      interviewerExtraSkills,
      ratio: 0,
      percent: null,
    }
  }

  const ratio = matchedSkills.length / candidate.length
  return {
    matchedSkills,
    candidateMissingSkills,
    interviewerExtraSkills,
    ratio,
    // One decimal place so 2/3 → 66.7
    percent: Math.round(ratio * 1000) / 10,
  }
}

export function skillMatchScore(candidateSkills: string[], interviewerSkills: string[]): number {
  return compareSkillSets(candidateSkills, interviewerSkills).ratio
}

export type { SkillMatchDetail }
