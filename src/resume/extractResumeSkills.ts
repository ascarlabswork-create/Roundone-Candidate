import { isCanonicalSkillDuplicate, uniqueCandidateSkillWording } from '../matching/skills.ts'
import type { ResumeSkillPlan } from './aiModel.ts'
import { keepTechnicalSkillsOnly, localResumeSkillPlan } from './localSkillPlan.ts'
import { extractTechnicalSkillsFromText, filterTechnicalResumeSkills } from './technicalSkills.ts'

function mergeUnique(existing: string[], incoming: string[]) {
  const next = [...existing]
  for (const skill of incoming) {
    const value = skill.trim()
    if (value.length < 2) continue
    if (isCanonicalSkillDuplicate(next, value)) continue
    next.push(value)
  }
  return uniqueCandidateSkillWording(next)
}

/** Collect technical skills from an AI or local resume plan. */
export function skillsFromResumePlan(plan: ResumeSkillPlan, existing: string[] = []) {
  const technical = keepTechnicalSkillsOnly(plan)
  const incoming: string[] = []
  for (const item of technical.extractedSkills) incoming.push(item.skill)
  for (const item of technical.inferredSkills) incoming.push(item.skill)
  for (const project of technical.projects) incoming.push(...project.technologies)
  for (const experience of technical.experiences) incoming.push(...experience.technologies)
  return mergeUnique(existing, filterTechnicalResumeSkills(incoming))
}

/**
 * Universal resume skill extraction used by Find / Welcome / Resume Skills.
 * Always unions AI evidence (when present) with local phrase + skills-section matching
 * so domain stacks are not dropped when the model returns a sparse list.
 */
export function extractSkillsFromResumeText(
  resumeText: string,
  options?: {
    existing?: string[]
    aiPlan?: ResumeSkillPlan | null
    limit?: number
  },
) {
  const existing = options?.existing ?? []
  const limit = options?.limit ?? 36
  const fromAi = options?.aiPlan ? skillsFromResumePlan(options.aiPlan, []) : []
  const fromLocal = extractTechnicalSkillsFromText(resumeText, limit)
  return mergeUnique(existing, [...fromAi, ...fromLocal]).slice(0, Math.max(limit, existing.length + fromAi.length))
}

/** Merge a local phrase plan into an AI plan so review UIs keep niche skills. */
export function mergeLocalSkillsIntoPlan(plan: ResumeSkillPlan, resumeText: string): ResumeSkillPlan {
  const local = localResumeSkillPlan(resumeText)
  if (!local) return keepTechnicalSkillsOnly(plan)

  const technical = keepTechnicalSkillsOnly(plan)
  const seen = new Set(technical.extractedSkills.map((item) => item.skill.toLowerCase()))
  const merged = [...technical.extractedSkills]
  for (const item of local.extractedSkills) {
    const key = item.skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
    if (merged.length >= 36) break
  }
  return {
    ...technical,
    extractedSkills: merged,
  }
}
