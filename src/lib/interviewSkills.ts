import type { InterviewType } from '../data/catalogs.ts'
import type { InterviewerFeedbackScores } from '../types.ts'

export function interviewSpecificSkill(type: InterviewType): {
  label: string
  key: keyof InterviewerFeedbackScores
} {
  if (type === 'Coding') return { label: 'Coding', key: 'coding' }
  if (type === 'System Design' || type === 'Machine Learning') {
    return { label: type, key: 'systemDesign' }
  }
  if (type === 'Behavioral' || type === 'Product') {
    return { label: type === 'Product' ? 'Product Sense' : 'Behavioral', key: 'behavioral' }
  }
  return { label: 'Technical Skills', key: 'technicalSkills' }
}
