import { improveResumeLocally } from './atsAiImprove.ts'
import { buildAtsFullReport } from './atsReport.ts'
import { formatResumeWithTemplate } from './atsTemplates.ts'
import { computeJobFitScore } from './atsCheck.ts'

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
expect(report.fitScore == null, 'no fit score without JD')

const tailored = buildAtsFullReport(
  resume,
  'We are hiring a Custom Software Engineer. Must have skills: SAP UI5 Development, AWS, Docker. Experience with frontend frameworks is required.',
  'Engineer',
)
expect(Boolean(tailored.jdMatch), 'JD match included')
expect((tailored.jdMatch?.missingSkills.length ?? 0) >= 1, 'SAP gap flagged')
expect(typeof tailored.fitScore === 'number', 'fit score present with JD')
expect((tailored.fitScore ?? 100) < (tailored.readiness.score ?? 0), 'fit below readiness when JD gaps exist')
expect(tailored.suggestions.length >= 1, 'suggestions present')
expect(
  tailored.fitScore === computeJobFitScore(tailored.readiness.score, tailored.jdMatch?.score ?? 0),
  'fit uses JD-weighted formula',
)

const improved = formatResumeWithTemplate(resume, 'classic', {
  missingJobSkills: ['SAP UI5'],
  matchedJobSkills: ['AWS', 'Docker'],
  jobDescription: 'Must have SAP UI5 Development, AWS, Docker.',
})
expect(/SKILLS/i.test(improved), 'skills heading present')
expect(/SAP UI5/i.test(improved), 'missing JD skill listed')
expect(/Targeting|Target keywords|Gap/i.test(improved), 'JD-tailored framing present')
expect(/SUMMARY/i.test(improved), 'summary heading present')

const flat =
  'Viraj Sharma DevOps Engineer Mumbai +91 98765 43210 viraj@email.com linkedin.com/in/viraj Professional Summary DevOps Engineer with 5+ years of experience building CI/CD pipelines on AWS. Skills AWS Docker Kubernetes Jenkins Terraform CloudFormation Linux Python Experience Built Jenkins pipelines reducing deploy time by 40%. Migrated workloads to Kubernetes (EKS). Automated infra with Terraform and CloudFormation. Education B.Tech Computer Science 2018'
const flatReport = buildAtsFullReport(
  flat,
  'Requirements: 3 years of experience in SAP UI5 Development. Must know SAP Fiori, OData, JavaScript, and ABAP.',
)
expect(flatReport.readiness.score >= 55, 'flattened PDF still scores')
expect((flatReport.jdMatch?.score ?? 100) < 40, 'DevOps vs SAP UI5 coverage low')
expect((flatReport.fitScore ?? 100) < 40, 'DevOps vs SAP UI5 fit score low')
expect((flatReport.jdMatch?.missingSkills.length ?? 0) >= 2, 'SAP skills flagged missing')
expect(flatReport.issues.some((issue) => issue.id === 'jd-fit'), 'jd-fit issue raised')
const flatImproved = formatResumeWithTemplate(flat, 'classic', {
  missingJobSkills: flatReport.jdMatch?.missingSkills.slice(0, 6) ?? [],
  matchedJobSkills: flatReport.jdMatch?.matchedSkills.slice(0, 6) ?? [],
  jobDescription: 'SAP UI5 Development with SAP Fiori and ABAP.',
  suggestions: flatReport.suggestions.slice(0, 4),
})
expect(/Viraj/i.test(flatImproved), 'name recovered from flat text')
expect(/SKILLS/i.test(flatImproved), 'flat template has skills')
expect(/Jenkins|Kubernetes|AWS/i.test(flatImproved), 'devops skills preserved')
expect(/SAP/i.test(flatImproved), 'JD gaps listed in tailored draft')
expect(/NEXT STEPS FOR THIS JD/i.test(flatImproved), 'next steps included')

const aiLocal = improveResumeLocally({
  resumeText: flat,
  jobDescription: 'Requirements: SAP UI5 Development, SAP Fiori, ABAP.',
  templateId: 'classic',
  matchedSkills: flatReport.jdMatch?.matchedSkills ?? [],
  missingSkills: flatReport.jdMatch?.missingSkills ?? [],
  suggestions: flatReport.suggestions.slice(0, 3),
})
expect(/SUMMARY/i.test(aiLocal.text), 'AI local improve has summary')
expect(/EXPERIENCE/i.test(aiLocal.text), 'AI local improve has experience')
expect(!/Gap vs this JD/i.test(aiLocal.text.split('COACHING NOTES')[0] ?? ''), 'resume body stays clean')
expect(aiLocal.coachingNotes.some((note) => /SAP/i.test(note)), 'coaching notes keep SAP gaps')

console.log('atsReport.check.ts passed')
