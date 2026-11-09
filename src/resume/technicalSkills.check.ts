import { keepTechnicalSkillsOnly, localResumeSkillPlan } from './localSkillPlan.ts'
import { extractTechnicalSkillsFromText, isTechnicalResumeSkill } from './technicalSkills.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(isTechnicalResumeSkill('Python') === true, 'Python is a technical skill')
expect(isTechnicalResumeSkill('Communication') === false, 'Communication is not a technical skill')
expect(isTechnicalResumeSkill('Product Sense') === false, 'Product Sense is not extracted as a tech skill')
expect(isTechnicalResumeSkill('Leadership') === false, 'Leadership is not a technical skill')

const sample = `
Skills: Communication, Java, AWS, Kubernetes, Docker, Linux, Git, GCP, C++, GitHub
Soft skills include teamwork and verbal communication.
`
const found = extractTechnicalSkillsFromText(sample)
expect(found.includes('Java'), 'Java is extracted')
expect(found.includes('AWS'), 'AWS is extracted')
expect(found.includes('Kubernetes'), 'Kubernetes is extracted')
expect(found.includes('Docker'), 'Docker is extracted')
expect(found.includes('Linux'), 'Linux is extracted')
expect(!found.includes('Communication'), 'Communication is not extracted')
expect(!found.some((skill) => /communication/i.test(skill)), 'No communication variant is extracted')

const plan = localResumeSkillPlan(sample)
expect(Boolean(plan), 'Local plan is built from the resume')
expect(
  plan!.extractedSkills.every((item) => item.skill.toLowerCase() !== 'communication'),
  'Local plan drops Communication',
)
expect(plan!.extractedSkills.some((item) => item.skill === 'Java'), 'Local plan keeps Java')

const cleaned = keepTechnicalSkillsOnly({
  profileSummary: '',
  extractedSkills: [
    { skill: 'Communication', category: 'extracted', evidenceType: 'skills_section', evidenceDetail: 'soft' },
    { skill: 'Java', category: 'extracted', evidenceType: 'skills_section', evidenceDetail: 'java' },
  ],
  inferredSkills: [
    { skill: 'Leadership', category: 'inferred', evidenceType: 'experience', evidenceDetail: 'led', inferredFrom: 'led teams' },
  ],
  interviewTopics: [],
  projects: [{ name: 'Demo Project', description: '', technologies: ['Communication', 'Docker'] }],
  experiences: [],
  certifications: [],
})
expect(cleaned.extractedSkills.map((item) => item.skill).join(',') === 'Java', 'AI plan keeps only technical extracted skills')
expect(cleaned.inferredSkills.length === 0, 'AI plan drops soft inferred skills')
expect(cleaned.projects[0]?.technologies.join(',') === 'Docker', 'Project technologies keep only tech skills')

console.log('technical resume skill checks passed')
