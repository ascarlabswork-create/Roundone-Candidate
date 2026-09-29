import { canonicalSkillAliases, skillDisplayName, skillsMatch } from '../matching/skillCanonical.ts'
import { dedupeSkills } from '../matching/skills.ts'
import { preserveReviewedSkills } from './review.ts'
import { extractExplicitSkills, extractJobFromHtml, extractJobFromManual, mentionsPhrase } from '../../supabase/functions/analyze-job/extract.ts'
import { JobFetchError, fetchPublicJobPage } from '../../supabase/functions/analyze-job/fetchPage.ts'
import { SKILL_PHRASES } from '../../supabase/functions/analyze-job/skillPhrases.ts'
import { checkJobUrl, isBlockedAddress } from '../../supabase/functions/analyze-job/ssrf.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const html = `<!doctype html><html><head>
<title>Ignored title</title>
<meta property="og:title" content="Fallback title">
<script type="application/ld+json">
{"@type":"JobPosting","title":"Data Analyst","description":"<p>Build Power BI dashboards. Experience with pandas and NumPy. Knowledge of machine learning algorithms. Python required.</p>","identifier":{"value":"JOB-42"},"hiringOrganization":{"name":"Northwind Labs"},"skills":["Python"]}
</script>
</head><body><nav>Home</nav><main><h2>Requirements</h2><p>PowerBI and communication skills.</p></main><footer>Legal</footer></body></html>`

const job = extractJobFromHtml(html, 'https://jobs.example.com/role')
expect(job.company_name === 'Northwind Labs', '2 company from JSON-LD')

const accenture = extractJobFromHtml(
  `<html><head><title>Custom Software Engineer</title><script type="application/ld+json">{"@type":"JobPosting","title":"Custom Software Engineer","description":"Develop custom software.","hiringOrganization":"Accenture","identifier":{"name":"Accenture","value":"ATCI-5198132-S1909476"}}</script></head><body></body></html>`,
  'https://www.accenture.com/in-en/careers/jobdetails?id=ATCI-5198132-S1909476_en',
)
expect(accenture.company_name === 'Accenture', '2 company from string hiringOrganization')
expect(accenture.job_title === 'Custom Software Engineer', '3 accenture title')
expect(accenture.job_id === 'ATCI-5198132-S1909476', '5 accenture job id')

const fromProse = extractJobFromHtml(
  `<html><head><title>Backend Engineer | Tata Consultancy Services</title><meta name="description" content="Learn more about the Backend Engineer position at Tata Consultancy Services."><meta property="og:site_name" content="LinkedIn"></head><body></body></html>`,
  'https://www.linkedin.com/jobs/view/1',
)
expect(fromProse.company_name === 'Tata Consultancy Services', 'company from posting text, not the job board')

const fromLabel = extractJobFromHtml(
  `<html><head><title>Engineer</title></head><body><p>Company: Deloitte</p></body></html>`,
  'https://in.indeed.com/viewjob?jk=1',
)
expect(fromLabel.company_name === 'Deloitte', 'company from labeled text')

const fromHost = extractJobFromHtml(
  `<html><head><title>Engineer</title></head><body><p>Build services.</p></body></html>`,
  'https://www.wipro.com/careers/123',
)
expect(fromHost.company_name === 'Wipro', 'company from employer career site')

const fromAts = extractJobFromHtml(
  `<html><head><title>Engineer</title></head><body></body></html>`,
  'https://boards.greenhouse.io/stripe/jobs/1',
)
expect(fromAts.company_name === 'Stripe', 'company from applicant tracking url')

const boardOnly = extractJobFromHtml(
  `<html><head><title>Engineer</title><meta property="og:site_name" content="Indeed"></head><body><p>Apply now.</p></body></html>`,
  'https://in.indeed.com/viewjob?jk=2',
)
expect(boardOnly.company_name === null, 'job board name is not the employer')

const legal = extractJobFromHtml(
  `<html><head></head><body><script type="application/ld+json">{"@type":"JobPosting","title":"Consultant","hiringOrganization":{"legalName":"Capgemini"}}</script></body></html>`,
  'https://www.capgemini.com/careers/1',
)
expect(legal.company_name === 'Capgemini', 'company from legalName')
expect(job.job_title === 'Data Analyst', '3 title from JSON-LD')
expect(job.description?.includes('Power BI dashboards') === true, '4 description')
expect(job.job_id === 'JOB-42', '5 job id')
const skills = dedupeSkills(job.skills)
expect(skills.includes('Python'), '6 Python')
expect(skills.includes('Pandas') && skills.includes('NumPy'), '6 pandas and NumPy')
expect(skills.includes('Machine Learning'), '6 machine learning algorithms')
expect(skills.includes('Power BI'), '6 Power BI')
expect(!skills.some((skill) => skill.toLowerCase() === 'communication'), '7 communication is not a skill')
expect(!skills.includes('Tableau'), '7 Tableau was not mentioned')
expect(skillDisplayName('PowerBI') === 'Power BI', '8 PowerBI label')
expect(skillDisplayName('Machine Learning Algorithms') === 'Machine Learning', '8 ML algorithms label')
expect(skillsMatch('powerbi', 'Power BI'), '8 alias match')

const edited = preserveReviewedSkills(['SQL', 'Python'], ['Power BI'])
expect(edited.includes('SQL') && edited.includes('Python') && !edited.includes('Power BI'), '9 manual edits preserved')

const manual = extractJobFromManual('We need Python and PowerBI. communication is important.', null)
expect(manual.source_type === 'manual' && manual.source_url === null, '10 manual source')
expect(dedupeSkills(manual.skills).includes('Python'), '10 manual skills')
expect(!manual.skills.some((skill) => skill.toLowerCase() === 'communication'), '10 soft skill dropped')

expect(!checkJobUrl('not a url').ok, '11 invalid url')
const fileUrl = checkJobUrl('file:///etc/passwd')
expect(!fileUrl.ok && fileUrl.reason === 'unsupported_url', '11 file url')
expect(isBlockedAddress('localhost'), '12 localhost')
expect(isBlockedAddress('127.0.0.1'), '12 loopback')
expect(isBlockedAddress('10.1.2.3'), '13 private 10')
expect(isBlockedAddress('192.168.1.9'), '13 private 192')
expect(isBlockedAddress('172.16.4.2'), '13 private 172')
expect(isBlockedAddress('169.254.1.1'), '13 link local')
expect(isBlockedAddress('::1'), '13 ipv6 loopback')

const timedOut = await fetchPublicJobPage('https://jobs.example.com/slow', {
  timeoutMs: 20,
  resolveHost: async () => ['93.184.216.34'],
  fetchImpl: (_input, init) =>
    new Promise((_resolve, reject) => {
      const signal = init.signal
      const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      if (signal?.aborted) fail()
      signal?.addEventListener('abort', fail)
    }),
}).then(
  () => 'ok',
  (error: unknown) => (error instanceof JobFetchError ? error.reason : 'other'),
)
expect(timedOut === 'timeout', '14 timeout')

const redirected = await fetchPublicJobPage('https://jobs.example.com/go', {
  resolveHost: async (host) => (host === 'localhost' || host === '127.0.0.1' ? ['127.0.0.1'] : ['93.184.216.34']),
  fetchImpl: async (input) => {
    if (String(input).includes('/go')) {
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } })
    }
    return new Response('<html>no</html>', { status: 200, headers: { 'content-type': 'text/html' } })
  },
}).then(
  () => 'ok',
  (error: unknown) => (error instanceof JobFetchError ? error.reason : 'other'),
)
expect(redirected === 'unsupported_url', '13 redirect to private ip')

const serialized = JSON.stringify(job)
expect(!serialized.includes('<script') && !serialized.includes('<p>'), '15 no raw html')
expect(!('html' in job), '15 no html field')

const phrases = [...SKILL_PHRASES].sort()
const aliases = canonicalSkillAliases().sort()
expect(phrases.join('|') === aliases.join('|'), 'phrase list matches canonical aliases')
expect(mentionsPhrase('Power BI dashboards', 'power bi'), 'phrase detection')
expect(extractExplicitSkills('team player and hard working').length === 0, 'generic words ignored')

console.log('analyzeJob.check passed')
