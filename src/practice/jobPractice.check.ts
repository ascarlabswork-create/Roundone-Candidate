import { parsePracticeNextQuestion, type PracticeSetup } from './aiModel.ts'
import { buildStructuredContext, toSafeJobContext, type CandidateContext } from './contextEngine.ts'
import { buildStartPracticePayload } from './progressModel.ts'
import { emptyPracticeSession } from './session.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const candidate: CandidateContext = {
  role: 'Data Analyst',
  level: 'Mid-Level',
  skills: ['SQL'],
  projects: ['Sales dashboard — weekly revenue'],
}

const general: PracticeSetup = {
  ...emptyPracticeSession().setup,
  targetRole: 'Data Analyst',
  interviewType: 'Technical',
  skills: ['SQL'],
  difficulty: 'intermediate',
  questionCount: 5,
}

const generalContext = buildStructuredContext(candidate, general, [])
expect(!('job' in generalContext), 'General practice context has no job')
expect(generalContext.interview.topics.join(',') === 'SQL', 'General topics stay the selected skills')
expect(generalContext.candidate.projects?.[0] === 'Sales dashboard — weekly revenue', 'Resume projects stay in context')

const generalPayload = buildStartPracticePayload(general)
expect(!('job_target_id' in generalPayload), 'General start payload has no job target')
expect(!('job_context' in generalPayload), 'The client does not send a job snapshot')

const jobSetup: PracticeSetup = {
  ...general,
  jobTargetId: '00000000-0000-4000-8000-000000000091',
  jobContext: {
    companyName: 'Northwind',
    jobTitle: 'Analytics Engineer',
    description: '<p>Build machine learning dashboards</p>',
    skills: ['Python', 'Power BI'],
  },
}

const jobPayload = buildStartPracticePayload(jobSetup)
expect(jobPayload.job_target_id === jobSetup.jobTargetId, 'Owned job target id is sent to the server')
expect(!('job_context' in jobPayload), 'Job snapshot is not trusted from the client payload')

const safe = toSafeJobContext(jobSetup.jobContext)
expect(safe?.company_name === 'Northwind', 'Company name is kept')
expect(safe?.description === 'Build machine learning dashboards', 'HTML is removed from the job description')
expect(safe?.skills.join(',') === 'Python,Power BI', 'Job skills are kept')

const jobContext = buildStructuredContext(candidate, jobSetup, [])
expect(jobContext.job?.job_title === 'Analytics Engineer', 'AI context includes the job title')
expect(jobContext.job?.company_name === 'Northwind', 'AI context includes the company')
expect(jobContext.job?.skills.includes('Power BI') === true, 'AI context includes required job skills')
expect(jobContext.interview.topics.includes('Python') === true, 'Job skills join the practice topics')
expect(jobContext.interview.topics.includes('SQL') === true, 'Candidate skills remain available')
expect(jobContext.candidate.role === 'Data Analyst', 'Candidate role stays the verified profile role')

const repeated = 'How would you model a Power BI dataset for a weekly revenue dashboard?'
const duplicate = parsePracticeNextQuestion(
  {
    question: repeated,
    question_type: 'technical',
    topic: 'Power BI',
    difficulty: 'intermediate',
    expected_focus: ['Data model', 'Relationships'],
  },
  jobSetup,
  2,
  [repeated],
)
expect(duplicate == null, 'Duplicate question protection still rejects a repeated question')

const fresh = parsePracticeNextQuestion(
  {
    question: 'How do you choose a Python model when the job description mentions machine learning?',
    question_type: 'technical',
    topic: 'Python',
    difficulty: 'intermediate',
    expected_focus: ['Model choice', 'Evaluation'],
  },
  jobSetup,
  2,
  [repeated],
)
expect(fresh?.topic === 'Python', 'A new job-skill question is accepted')
expect(fresh?.question !== repeated, 'The accepted question is not the previous one')

console.log('job practice checks passed')
