import { collapseRelatedSkills, evaluateAtsReadiness, evaluateJdMatch, normalizeResumeText } from './atsCheck.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const weak = evaluateAtsReadiness('I am a developer.')
expect(weak.score < 50, 'short resume scores low')
expect(weak.improvements.length > 0, 'short resume has improvements')

const flatPdfStyle = normalizeResumeText(
  'Viraj Soni DevOps Engineer viraj.soni at gmail.com +91 9876543210 Professional Summary Skills AWS Docker Kubernetes Experience Software Engineer 2021 2024 Education B.Tech Computer Science • Built CI/CD pipelines • Reduced latency 30%',
)
const flat = evaluateAtsReadiness(flatPdfStyle)
expect(flat.items.some((item) => item.id === 'contact-email' && item.passed), 'email with at-obfuscation detected')
expect(flat.items.some((item) => item.id === 'skills-section' && item.passed), 'skills heading in flattened text')
expect(flat.items.some((item) => item.id === 'experience-section' && item.passed), 'experience heading in flattened text')
expect(flat.items.some((item) => item.id === 'education-section' && item.passed), 'education detected')
expect(flat.score >= 50, 'flattened devops resume should not stay near zero')

const strongResume = `
John Doe
john.doe@example.com
+91 98765 43210

Skills
React, TypeScript, Node.js, SQL, AWS

Experience
Software Engineer — Acme (2021 – 2024)
• Built React dashboards used by 50k users
• Cut API latency 30% with Node.js services

Education
B.Tech Computer Science — 2020

Projects
Interview Prep Platform project with TypeScript and SQL
`

const strong = evaluateAtsReadiness(strongResume)
expect(strong.score >= 70, 'complete resume scores high')
expect(strong.items.some((item) => item.id === 'contact-email' && item.passed), 'email detected')
expect(strong.items.some((item) => item.id === 'skills-section' && item.passed), 'skills section detected')

const collapsed = collapseRelatedSkills(['SAP UI5 Development', 'UI5 Development', 'SAP UI5', 'React'])
expect(collapsed.length <= 3, 'near-duplicate SAP skills collapsed')
expect(collapsed.some((skill) => /react/i.test(skill)), 'react kept')

const jd = evaluateJdMatch(
  strongResume,
  'Must Have Skills: React, TypeScript, SAP UI5 Development, SAP UI5, UI5 Development',
  'Frontend Engineer',
  ['React', 'TypeScript', 'SAP UI5', 'SAP UI5 Development', 'UI5 Development'],
)
expect(jd.matchedSkills.includes('React'), 'React matched')
expect(jd.matchedSkills.includes('TypeScript'), 'TypeScript matched')
expect(jd.missingSkills.length === 1, 'SAP variants collapsed to one missing skill')
expect(jd.score > 0 && jd.score < 100, 'partial JD coverage')

console.log('atsCheck.check.ts passed')
