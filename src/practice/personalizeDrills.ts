import { INTERVIEW_TYPES, type InterviewType } from '../data/catalogs.ts'
import { PRACTICE_DRILLS, type PracticeDrill, type PracticeQuestion } from '../data/practiceDrills.ts'

/** Skill phrases that pull a timed drill type toward the top for this candidate. */
const TYPE_SKILL_HINTS: Record<InterviewType, string[]> = {
  Coding: [
    'python',
    'java',
    'javascript',
    'typescript',
    'c++',
    'c#',
    'golang',
    'go',
    'rust',
    'kotlin',
    'swift',
    'dsa',
    'algorithms',
    'data structures',
    'leetcode',
    'sql',
    'node',
    'react',
    'abap',
  ],
  'System Design': [
    'system design',
    'microservices',
    'distributed',
    'kafka',
    'redis',
    'aws',
    'gcp',
    'azure',
    'kubernetes',
    'docker',
    'scalability',
    'api',
    'graphql',
    'architecture',
  ],
  Behavioral: ['leadership', 'communication', 'stakeholder', 'mentorship', 'conflict'],
  'Machine Learning': [
    'machine learning',
    'deep learning',
    'pytorch',
    'tensorflow',
    'scikit',
    'nlp',
    'computer vision',
    'ml',
    'llm',
    'xgboost',
  ],
  Product: ['product', 'roadmap', 'north star', 'user research', 'prioritization', 'pm'],
  'Data Science': [
    'data science',
    'pandas',
    'numpy',
    'tableau',
    'power bi',
    'statistics',
    'a/b',
    'experiment',
    'sql',
    'etl',
    'spark',
  ],
  'Technical Round': [
    'debugging',
    'testing',
    'git',
    'ci/cd',
    'linux',
    'backend',
    'frontend',
    'fullstack',
    'devops',
    'sap',
    'odata',
    'rest',
  ],
}

function skillKey(skill: string) {
  return skill.trim().toLowerCase().replace(/\s+/g, ' ')
}

function skillMatchesHint(skill: string, hint: string) {
  const key = skillKey(skill)
  const needle = hint.toLowerCase()
  return key === needle || key.includes(needle) || needle.includes(key)
}

export function skillsForInterviewType(type: InterviewType, skills: string[]) {
  const hints = TYPE_SKILL_HINTS[type]
  return skills.filter((skill) => hints.some((hint) => skillMatchesHint(skill, hint))).slice(0, 4)
}

export function interviewTypeAffinity(type: InterviewType, skills: string[]) {
  if (skills.length === 0) {
    // Keep a stable default order when the profile has no skills yet.
    return INTERVIEW_TYPES.length - INTERVIEW_TYPES.indexOf(type)
  }
  let score = 0
  for (const hint of TYPE_SKILL_HINTS[type]) {
    if (skills.some((skill) => skillMatchesHint(skill, hint))) {
      score += hint.length >= 5 ? 3 : 2
    }
  }
  if (type === 'Technical Round' && skills.length > 0) score += 1
  if (type === 'Behavioral') score += 0.5
  return score
}

/** Highest-affinity interview types first, then the rest of the catalog. */
export function rankInterviewTypesForSkills(skills: string[]): InterviewType[] {
  return [...INTERVIEW_TYPES].sort((a, b) => {
    const diff = interviewTypeAffinity(b, skills) - interviewTypeAffinity(a, skills)
    if (diff !== 0) return diff
    return INTERVIEW_TYPES.indexOf(a) - INTERVIEW_TYPES.indexOf(b)
  })
}

function personalizeQuestion(
  question: PracticeQuestion,
  focusSkills: string[],
  targetRole: string,
  index: number,
): PracticeQuestion {
  if (focusSkills.length === 0) return question
  const focus = focusSkills.slice(0, 3).join(', ')
  const roleBit = targetRole.trim() ? ` for a ${targetRole.trim()} role` : ''
  const grounding =
    index === 0
      ? `\n\nGround your answer in your experience with ${focus}${roleBit}. Prefer concrete examples from projects where you used these skills.`
      : `\n\nWhere it helps, connect the answer to ${focus}.`
  return {
    ...question,
    prompt: `${question.prompt}${grounding}`,
  }
}

/** Clone a catalog drill and ground prompts in this candidate's skills/role. */
export function personalizePracticeDrill(
  type: InterviewType,
  skills: string[],
  targetRole = '',
): PracticeDrill {
  const base = PRACTICE_DRILLS[type]
  const focus = skillsForInterviewType(type, skills)
  const fallbackFocus = focus.length > 0 ? focus : skills.slice(0, 3)
  if (fallbackFocus.length === 0) return base

  const summaryFocus = focus.length > 0 ? focus : fallbackFocus
  return {
    ...base,
    summary:
      focus.length > 0
        ? `Built around your ${summaryFocus.join(', ')} skills. ${base.summary}`
        : `Uses your profile skills (${summaryFocus.join(', ')}) inside a ${type} drill. ${base.summary}`,
    checklist: [
      `Use ${summaryFocus[0]} in at least one answer`,
      ...base.checklist.filter((item) => !/use /i.test(item)).slice(0, 3),
    ],
    questions: base.questions.map((question, index) =>
      personalizeQuestion(question, fallbackFocus, targetRole, index),
    ),
  }
}

export function practiceDrillMatchLabel(type: InterviewType, skills: string[]) {
  const focus = skillsForInterviewType(type, skills)
  if (focus.length === 0) return null
  return focus.slice(0, 2).join(', ')
}
