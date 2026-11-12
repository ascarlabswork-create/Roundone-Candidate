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

const flat =
  'Viraj Sharma DevOps Engineer Mumbai +91 98765 43210 viraj@email.com linkedin.com/in/viraj Professional Summary DevOps Engineer with 5+ years of experience building CI/CD pipelines on AWS. Skills AWS Docker Kubernetes Jenkins Terraform CloudFormation Linux Python Experience Built Jenkins pipelines reducing deploy time by 40%. Migrated workloads to Kubernetes (EKS). Automated infra with Terraform and CloudFormation. Education B.Tech Computer Science 2018'
const flatReport = buildAtsFullReport(
  flat,
  'Requirements: 3 years of experience in SAP UI5 Development. Must know SAP Fiori, OData, JavaScript, and ABAP.',
)
expect(flatReport.readiness.score >= 55, 'flattened PDF still scores')
expect((flatReport.jdMatch?.score ?? 100) < 40, 'DevOps vs SAP UI5 scores low')
expect((flatReport.jdMatch?.missingSkills.length ?? 0) >= 2, 'SAP skills flagged missing')
const flatImproved = formatResumeWithTemplate(flat, 'classic', {
  missingJobSkills: flatReport.jdMatch?.missingSkills.slice(0, 6) ?? [],
})
expect(/Viraj/i.test(flatImproved), 'name recovered from flat text')
expect(/SKILLS/i.test(flatImproved), 'flat template has skills')
expect(/Jenkins|Kubernetes|AWS/i.test(flatImproved), 'devops skills preserved')
expect(/SAP/i.test(flatImproved), 'JD gaps injected into template')

console.log('atsReport.check.ts passed')
