import { evaluateAtsReadiness, evaluateJdMatch } from './atsCheck.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const weak = evaluateAtsReadiness('I am a developer.')
expect(weak.score < 50, 'short resume scores low')
expect(weak.improvements.length > 0, 'short resume has improvements')

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

const jd = evaluateJdMatch(
  strongResume,
  'Must Have Skills: React, TypeScript, SAP UI5 Development',
  'Frontend Engineer',
  ['React', 'TypeScript', 'SAP UI5'],
)
expect(jd.matchedSkills.includes('React'), 'React matched')
expect(jd.matchedSkills.includes('TypeScript'), 'TypeScript matched')
expect(jd.missingSkills.some((skill) => /sap/i.test(skill)), 'SAP UI5 missing flagged')
expect(jd.score > 0 && jd.score < 100, 'partial JD coverage')

console.log('atsCheck.check.ts passed')
