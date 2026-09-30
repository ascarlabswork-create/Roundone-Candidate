import { attachJobContext, jobPracticeRules, readSafeJobContext } from './jobPractice.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const base = {
  setup: { targetRole: 'Data Analyst', interviewType: 'Technical', skills: ['SQL'] },
  question_number: 1,
  prior_turns: [],
}

const general = attachJobContext(base, null)
expect(!('job_context' in general), 'General mode model payload has no job context')
expect(jobPracticeRules(null).length === 0, 'General mode adds no job-specific prompt rules')

const job = readSafeJobContext({
  company_name: 'Northwind',
  job_title: 'Analytics Engineer',
  description: '<div>Build machine learning dashboards</div>',
  skills: ['Python', 'Power BI', '<b>Python</b>'],
  source_url: 'https://secret.example/job',
  raw_html: '<html>secret</html>',
})
expect(job != null, 'A saved job snapshot is readable')
expect(job?.description === 'Build machine learning dashboards', 'Description HTML is stripped')
expect(job?.skills.join(',') === 'Python,Power BI', 'Duplicate and tagged skills collapse')
expect(!JSON.stringify(job).includes('source_url'), 'Source URL is not part of the AI job context')
expect(!JSON.stringify(job).includes('raw_html'), 'Raw HTML is not part of the AI job context')
expect(!JSON.stringify(job).includes('<'), 'The AI job context contains no HTML tags')

const rules = jobPracticeRules(job)
const rulesText = rules.join(' ')
expect(rulesText.includes('practice question'), 'Questions are labeled as practice')
expect(rulesText.includes('Never claim a question came from the real company'), 'Real-company interview claims are forbidden')
expect(rulesText.includes('Never invent candidate experience'), 'Invented experience is forbidden')
expect(rulesText.includes('Do not invent company facts'), 'Invented company facts are forbidden')
expect(rulesText.includes('Python') && rulesText.includes('Power BI'), 'Required skills are called out for question generation')

const sent = attachJobContext(base, job)
expect(sent.job_context.job_title === 'Analytics Engineer', 'The model payload includes the job title')
expect(sent.job_context.skills.includes('Power BI'), 'The model payload includes job skills')
expect(Object.keys(sent).sort().join(',') === 'job_context,prior_turns,question_number,setup', 'Only the job snapshot is added')

console.log('assist job practice checks passed')
