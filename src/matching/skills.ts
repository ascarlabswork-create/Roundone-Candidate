import type { SkillMatchDetail } from '../types.ts'

/** Skill-only matching helpers. Exact overlap after trim + lowercase; no aliases. */

export function normalizeSkill(value: string) {
  return value.trim().toLowerCase()
}

/** Deduplicate case-insensitively, keeping first-seen display casing. */
export function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of skills) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = normalizeSkill(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
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
