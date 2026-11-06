import { SKILLS } from '../data/catalogs.ts'
import type { ResumeSkillPlan } from './aiModel.ts'

const EXTRA_SKILLS = [
  'Decision Tree',
  'Random Forest',
  'Logistic Regression',
  'Linear Regression',
  'SVM',
  'Support Vector Machine',
  'Pandas',
  'NumPy',
  'Scikit-learn',
  'TensorFlow',
  'Keras',
  'OpenCV',
  'Matplotlib',
  'Streamlit',
  'Excel',
  'Power BI',
  'Tableau',
  'Git',
  'GitHub',
  'Docker',
  'NLP',
  'CNN',
  'Deep Learning',
  'Data Analysis',
  'Natural Language Processing',
  'Computer Vision',
  'PostgreSQL',
  'MySQL',
  'SQLite',
  'MongoDB',
  'FastAPI',
  'Flask',
  'Django',
  'Spring',
  'HTML',
  'CSS',
  'C++',
  'Jupyter',
  'FAISS',
  'SMOTE',
]

function projectTitle(chunk: string) {
  const name = chunk.replace(/\s+/g, ' ').trim()
  const words = name.split(' ').filter(Boolean)
  if (words.length < 2 || words.length > 16) return ''
  if (name.length < 12 || name.length > 100) return ''
  if (!/\bproject\b/i.test(name)) return ''
  if (/\b(education|cgpa|percentage|school|college)\b/i.test(name)) return ''
  return name.slice(0, 120)
}

function grounded(term: string, rawLower: string) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(rawLower)
}

/** Reviewable skills copied from the resume when AI analysis is unavailable. */
export function localResumeSkillPlan(resumeText: string): ResumeSkillPlan | null {
  const rawLower = ` ${resumeText.toLowerCase().replace(/\s+/g, ' ')} `
  const phrases = [...SKILLS, ...EXTRA_SKILLS].sort((a, b) => b.length - a.length)
  const extractedSkills: ResumeSkillPlan['extractedSkills'] = []
  const seen = new Set<string>()
  for (const skill of phrases) {
    if (skill.length < 2 || !grounded(skill, rawLower)) continue
    const key = skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const at = rawLower.indexOf(key)
    extractedSkills.push({
      skill,
      category: 'extracted',
      evidenceType: 'skills_section',
      evidenceDetail: rawLower.slice(Math.max(0, at - 24), at + key.length + 40).trim().slice(0, 160),
    })
    if (extractedSkills.length >= 20) break
  }

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
