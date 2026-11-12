import { buildAtsFullReport } from './atsReport.ts'
import { formatResumeWithTemplate } from './atsTemplates.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const resume = `
Viraj Soni
viraj@example.com
+91 9876543210

Summary
DevOps engineer with AWS, Docker, and Kubernetes experience.

Skills
AWS, Docker, Kubernetes, Jenkins, Terraform

Experience
DevOps Engineer — Acme (2021 – 2024)
• Built CI/CD pipelines that cut deploy time 40%
• Migrated services to AWS with Terraform

Education
B.Tech Computer Science — 2020
`

const report = buildAtsFullReport(resume)
expect(report.readiness.score >= 60, 'solid resume scores reasonably')
expect(report.categories.length === 3, 'three categories')
expect(report.parseRate >= 50, 'parse rate present')

const tailored = buildAtsFullReport(
  resume,
  'We are hiring a Custom Software Engineer. Must have skills: SAP UI5 Development, AWS, Docker. Experience with frontend frameworks is required.',
  'Engineer',
)
expect(Boolean(tailored.jdMatch), 'JD match included')
expect((tailored.jdMatch?.missingSkills.length ?? 0) >= 1, 'SAP gap flagged')

const improved = formatResumeWithTemplate(resume, 'classic', { missingJobSkills: ['SAP UI5'] })
expect(/SKILLS/i.test(improved), 'skills heading present')
expect(/SAP UI5/i.test(improved), 'missing JD skill injected')
expect(/SUMMARY/i.test(improved), 'summary heading present')

console.log('atsReport.check.ts passed')
