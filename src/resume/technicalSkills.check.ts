import { keepTechnicalSkillsOnly, localResumeSkillPlan } from './localSkillPlan.ts'
import { extractSkillsFromResumeText } from './extractResumeSkills.ts'
import {
  extractTechnicalSkillsFromText,
  isTechnicalResumeSkill,
  looksLikeTechnicalFreeformSkill,
} from './technicalSkills.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(isTechnicalResumeSkill('Python') === true, 'Python is a technical skill')
expect(isTechnicalResumeSkill('Communication') === false, 'Communication is not a technical skill')
expect(isTechnicalResumeSkill('Product Sense') === false, 'Product Sense is not extracted as a tech skill')
expect(isTechnicalResumeSkill('Leadership') === false, 'Leadership is not a technical skill')
expect(looksLikeTechnicalFreeformSkill('Next.js') === true, 'Next.js looks technical')
expect(looksLikeTechnicalFreeformSkill('Developed APIs for clients') === false, 'Sentence fragment is not a skill')

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

const sapResume = `
TECHNICAL SKILLS
Programming: SAP ABAP, ABAP Objects, ABAP on HANA, SQL, JavaScript
SAP Technologies: SAP ECC, SAP S/4HANA, CDS Views, AMDP, RAP, OData V2/V4, SAP Gateway
Interfaces: BAPI, RFC, IDoc, Proxy, REST APIs, SOAP, OData
Other Skills: SAP BTP, SAP Fiori, ATC, Git
`
const sapSkills = extractTechnicalSkillsFromText(sapResume, 30)
expect(sapSkills.includes('SAP ABAP') || sapSkills.includes('ABAP'), 'SAP ABAP/ABAP extracted')
expect(sapSkills.includes('SAP S/4HANA'), 'SAP S/4HANA extracted')
expect(sapSkills.includes('CDS Views'), 'CDS Views extracted')
expect(sapSkills.includes('JavaScript'), 'JavaScript extracted')
expect(sapSkills.includes('SQL'), 'SQL extracted')
expect(sapSkills.includes('Git'), 'Git extracted')
expect(sapSkills.includes('SAP Fiori'), 'SAP Fiori extracted')
expect(sapSkills.includes('REST API') || sapSkills.includes('REST APIs'), 'REST API(s) extracted')
expect(sapSkills.length >= 10, 'SAP resume yields a rich skill list')

const frontendResume = `
Skills / Technologies
Languages: TypeScript, JavaScript, HTML, CSS
Frameworks: React, Next.js, Redux, Tailwind CSS
Testing: Jest, Cypress, Playwright
Tools: Git, Vite, Webpack
`
const frontend = extractSkillsFromResumeText(frontendResume)
expect(frontend.includes('TypeScript'), 'Frontend TypeScript')
expect(frontend.includes('React'), 'Frontend React')
expect(frontend.includes('Next.js'), 'Frontend Next.js')
expect(frontend.includes('Tailwind CSS') || frontend.includes('Jest'), 'Frontend tooling present')
expect(frontend.length >= 6, 'Frontend resume extracts multiple skills')

const backendResume = `
Technical Skills
Python, FastAPI, Django, PostgreSQL, Redis, Docker, Kubernetes, Kafka, AWS, SQL, Git
`
const backend = extractSkillsFromResumeText(backendResume)
expect(backend.includes('Python'), 'Backend Python')
expect(backend.includes('FastAPI') || backend.includes('Django'), 'Backend framework')
expect(backend.includes('PostgreSQL'), 'Backend PostgreSQL')
expect(backend.includes('Docker'), 'Backend Docker')
expect(backend.includes('Kubernetes'), 'Backend Kubernetes')

const dataResume = `
Skills
Machine Learning, Deep Learning, PyTorch, TensorFlow, Pandas, NumPy, SQL, Spark, Airflow, Tableau
`
const data = extractSkillsFromResumeText(dataResume)
expect(data.includes('Machine Learning') || data.includes('PyTorch'), 'Data ML stack')
expect(data.includes('Pandas') || data.includes('NumPy'), 'Data Python libs')
expect(data.includes('SQL'), 'Data SQL')

const mobileResume = `
Tech Stack: Kotlin, Jetpack Compose, Swift, SwiftUI, Flutter, Dart, Firebase, Android SDK, Git
`
const mobile = extractSkillsFromResumeText(mobileResume)
expect(mobile.includes('Kotlin') || mobile.includes('Swift') || mobile.includes('Flutter'), 'Mobile platform skill')
expect(mobile.includes('Firebase') || mobile.includes('Git'), 'Mobile tooling')

const devopsResume = `
Tools & Technologies: Terraform, Ansible, Jenkins, GitHub Actions, Prometheus, Grafana, Helm, Linux, AWS, Docker, Kubernetes
`
const devops = extractSkillsFromResumeText(devopsResume)
expect(devops.includes('Terraform'), 'DevOps Terraform')
expect(devops.includes('Kubernetes'), 'DevOps Kubernetes')
expect(devops.includes('Docker'), 'DevOps Docker')
expect(devops.includes('AWS'), 'DevOps AWS')

console.log('technical resume skill checks passed')
