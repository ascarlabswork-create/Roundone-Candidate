import type { SkillMatchDetail } from '../../types.ts'

export function formatSkillPercentLabel(percent: number | null | undefined) {
  if (percent == null || Number.isNaN(percent)) return null
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

export function skillOverlapSummary(skillMatch: SkillMatchDetail) {
  const matched = skillMatch.matchedSkills.length
  const total = matched + skillMatch.candidateMissingSkills.length
  if (total === 0) return ''
  return `Matches ${matched} of your ${total} skill${total === 1 ? '' : 's'}`
}
