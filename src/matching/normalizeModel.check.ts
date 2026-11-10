import {
  buildNormalizationPatch,
  constrainNormalizedToVocabulary,
  inferRoleFromSkills,
  parseNormalizationAiResponse,
  reconcileNormalizationWithSkills,
  toUsableNormalization,
  type MatchingVocabulary,
} from './normalizeModel.ts'
import type { MatchingAiNormalized } from './aiModel.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const vocabulary: MatchingVocabulary = {
  roles: [
    'Software Engineer',
    'Backend Engineer',
    'Frontend Engineer',
    'Data Analyst',
    'ML Engineer',
    'Data Scientist',
  ],
  skills: ['Python', 'FastAPI', 'React', 'Node.js', 'REST APIs', 'SQL', 'Power BI', 'PyTorch'],
  interviewTypes: ['Coding', 'System Design', 'Behavioral', 'Data Science', 'Machine Learning'],
  candidateLevels: ['SDE 2', 'Senior'],
  companies: ['Google', 'Amazon'],
}

export function runNormalizationChecks() {
  const parsed = parseNormalizationAiResponse(
    {
      target_role: { value: 'Backend Engineer', confidence: 0.94 },
      candidate_level: { value: 'SDE 2', confidence: 0.7 },
      skills: [
        { value: 'Python', confidence: 0.98 },
        { value: 'FastAPI', confidence: 0.91 },
        { value: 'Invented Skill', confidence: 0.99 },
        { value: 'React', confidence: 0.4 },
      ],
      interview_type: { value: 'System Design', confidence: 0.9 },
      target_company: { value: 'Not A Company', confidence: 0.99 },
    },
    vocabulary,
  )
  expect(parsed != null, 'Valid payload parses')
  expect(parsed!.targetRole?.value === 'Backend Engineer', 'Role maps to vocabulary')
  expect(parsed!.skills.some((skill) => skill.value === 'Python'), 'Known skill is kept')
  expect(parsed!.skills.some((skill) => skill.value === 'FastAPI'), 'Known skill FastAPI is kept')
  expect(!parsed!.skills.some((skill) => skill.value === 'Invented Skill'), 'Unsupported skills are dropped')
  expect(parsed!.skills.some((skill) => skill.value === 'React' && skill.confidence === 0.4), 'Low-confidence known skill is parsed')
  expect(parsed!.targetCompany == null, 'Unsupported company is dropped')

  const usable = toUsableNormalization(parsed!, {
    targetRole: 'backend python',
    candidateLevel: 'SDE 2',
    skills: ['Python'],
    interviewType: 'system design round',
    targetCompany: '',
    intent: 'I am looking for a backend interview focused on Python, FastAPI and APIs.',
  })
  expect(usable.targetRole?.value === 'Backend Engineer', 'Role suggestion is kept')
  expect(usable.targetRole?.band === 'high', 'High-confidence role is marked high')
  expect(usable.candidateLevel == null, 'Existing canonical level is not re-suggested')
  expect(usable.skills.some((skill) => skill.value === 'FastAPI'), 'New high-confidence skill is suggested')
  expect(!usable.skills.some((skill) => skill.value === 'Python'), 'Existing skill is not re-suggested')
  expect(!usable.skills.some((skill) => skill.value === 'React'), 'Low-confidence skill is not suggested')
  expect(usable.interviewType?.value === 'System Design', 'Interview type is normalized')

  const patch = buildNormalizationPatch({ skills: ['Python'] }, usable)
  expect(patch.targetRole === 'Backend Engineer', 'Apply uses the suggested role')
  expect(patch.skills?.includes('Python') === true, 'Existing skills are preserved')
  expect(patch.skills?.includes('FastAPI') === true, 'Suggested skills are added after confirm')

  const malformed = parseNormalizationAiResponse({ target_role: 'Backend Engineer' }, vocabulary)
  expect(malformed?.targetRole == null, 'Unstructured fields are rejected')

  const unconstrained: MatchingAiNormalized = {
    targetRole: 'Wizard Engineer',
    candidateLevel: 'SDE 2',
    skills: ['Python', 'Telepathy'],
    interviewType: 'System Design',
    domainPreference: 'Startups',
  }
  const grounded = constrainNormalizedToVocabulary(unconstrained, vocabulary)
  expect(grounded?.targetRole === '', 'Matching-layer invented roles are dropped')
  expect(grounded?.candidateLevel === 'SDE 2', 'Known matching-layer level is kept')
  expect(grounded?.skills.includes('Python') === true, 'Known matching-layer skill is kept')
  expect(!grounded?.skills.includes('Telepathy'), 'Invented matching-layer skill is dropped')
  expect(grounded?.interviewType === 'System Design', 'Known matching-layer type is kept')

  const missingConfidence = parseNormalizationAiResponse(
    { target_role: { value: 'Backend Engineer' }, skills: [] },
    vocabulary,
  )
  expect(missingConfidence?.targetRole == null, 'Missing confidence is rejected')

  const overconfident = parseNormalizationAiResponse(
    { interview_type: { value: 'Coding', confidence: 1.2 }, skills: [] },
    vocabulary,
  )
  expect(overconfident?.interviewType == null, 'Out-of-range confidence is rejected')

  const analyst = inferRoleFromSkills(['SQL', 'Powerbi'])
  expect(analyst?.targetRole.value === 'Data Analyst', 'SQL + Power BI maps to Data Analyst')
  expect(analyst?.interviewType.value === 'Data Science', 'Analyst interview type is Data Science')

  const ml = inferRoleFromSkills(['PyTorch', 'Machine Learning'])
  expect(ml?.targetRole.value === 'ML Engineer', 'PyTorch + ML maps to ML Engineer')

  const sqlOnly = inferRoleFromSkills(['SQL'])
  expect(sqlOnly == null, 'SQL alone does not invent a role')

  const mismatched = reconcileNormalizationWithSkills(
    {
      targetRole: { value: 'ML Engineer', confidence: 0.99 },
      candidateLevel: null,
      skills: [],
      interviewType: { value: 'Machine Learning', confidence: 0.9 },
      targetCompany: null,
    },
    {
      targetRole: '',
      candidateLevel: '',
      skills: ['SQL', 'Power BI'],
      interviewType: '',
      targetCompany: '',
      intent: '',
    },
  )
  expect(mismatched.targetRole?.value === 'Data Analyst', 'AI ML role is replaced for SQL + Power BI')
  expect(mismatched.interviewType?.value === 'Data Science', 'Interview type follows the skill-grounded role')

  const fixed = toUsableNormalization(
    {
      targetRole: { value: 'ML Engineer', confidence: 0.99 },
      candidateLevel: null,
      skills: [],
      interviewType: null,
      targetCompany: null,
    },
    {
      targetRole: '',
      candidateLevel: '',
      skills: ['SQL', 'Powerbi'],
      interviewType: '',
      targetCompany: '',
      intent: '',
    },
  )
  expect(fixed.targetRole?.value === 'Data Analyst', 'Usable suggestions show Data Analyst for BI skills')

  return true
}

runNormalizationChecks()
console.log('normalization checks passed')
