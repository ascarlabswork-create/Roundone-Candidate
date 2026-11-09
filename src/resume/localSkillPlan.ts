import type { ResumeSkillPlan } from './aiModel.ts'
import { extractTechnicalSkillsFromText, isTechnicalResumeSkill } from './technicalSkills.ts'

function projectTitle(chunk: string) {
  const name = chunk.replace(/\s+/g, ' ').trim()
  const words = name.split(' ').filter(Boolean)
  if (words.length < 2 || words.length > 16) return ''
  if (name.length < 12 || name.length > 100) return ''
  if (!/\bproject\b/i.test(name)) return ''
  if (/\b(education|cgpa|percentage|school|college)\b/i.test(name)) return ''
  return name.slice(0, 120)
}

/** Reviewable technical skills copied from the resume when AI analysis is unavailable. */
export function localResumeSkillPlan(resumeText: string): ResumeSkillPlan | null {
  const rawLower = ` ${resumeText.toLowerCase().replace(/\s+/g, ' ')} `
  const extractedSkills: ResumeSkillPlan['extractedSkills'] = extractTechnicalSkillsFromText(resumeText, 20).map(
    (skill) => {
      const key = skill.toLowerCase()
      const at = rawLower.indexOf(key)
      return {
        skill,
        category: 'extracted' as const,
        evidenceType: 'skills_section' as const,
        evidenceDetail: rawLower.slice(Math.max(0, at - 24), at + key.length + 40).trim().slice(0, 160),
      }
    },
  )

  const projects: ResumeSkillPlan['projects'] = []
  for (const chunk of resumeText.split(/[•|\n]/)) {
    const name = projectTitle(chunk)
    if (!name) continue
    if (projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) continue
    projects.push({
      name: name.slice(0, 120),
      description: '',
      technologies: extractedSkills
        .map((item) => item.skill)
        .filter((skill) => name.toLowerCase().includes(skill.toLowerCase())),
    })
    if (projects.length >= 8) break
  }

  if (extractedSkills.length === 0 && projects.length === 0) return null
  return {
    profileSummary: '',
    extractedSkills,
    inferredSkills: [],
    interviewTopics: [],
    projects,
    experiences: [],
    certifications: [],
  }
}

/** Drop soft skills from an AI or local plan before the candidate reviews or saves them. */
export function keepTechnicalSkillsOnly(plan: ResumeSkillPlan): ResumeSkillPlan {
  return {
    ...plan,
    extractedSkills: plan.extractedSkills.filter((item) => isTechnicalResumeSkill(item.skill)),
    inferredSkills: plan.inferredSkills.filter((item) => isTechnicalResumeSkill(item.skill)),
    projects: plan.projects.map((project) => ({
      ...project,
      technologies: project.technologies.filter((skill) => isTechnicalResumeSkill(skill)),
    })),
    experiences: plan.experiences.map((experience) => ({
      ...experience,
      technologies: experience.technologies.filter((skill) => isTechnicalResumeSkill(skill)),
    })),
  }
}
