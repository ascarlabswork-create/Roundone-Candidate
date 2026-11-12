import { SKILLS } from '../data/catalogs.ts'

/** Soft skills and process words that often appear on resumes but are not tech skills. */
const NON_TECHNICAL_SKILLS = new Set(
  [
    'Communication',
    'Communications',
    'Verbal Communication',
    'Written Communication',
    'Leadership',
    'Teamwork',
    'Collaboration',
    'Problem Solving',
    'Critical Thinking',
    'Time Management',
    'Adaptability',
    'Creativity',
    'Presentation',
    'Presentations',
    'Mentoring',
    'Management',
    'Stakeholder Management',
    'Product Sense',
    'Agile',
    'Scrum',
    'Kanban',
    'English',
    'Hindi',
    'Spanish',
  ].map((skill) => skill.toLowerCase()),
)

/** Extra technical phrases commonly found on resumes beyond the shared catalog. */
export const EXTRA_TECHNICAL_SKILLS = [
  'Decision Tree',
  'Random Forest',
  'Logistic Regression',
  'Linear Regression',
  'Support Vector Machine',
  'Natural Language Processing',
  'Computer Vision',
  'Data Analysis',
  'Distributed Systems',
  'System Design',
  'Microservices',
  'Machine Learning',
  'Deep Learning',
  'Scikit-learn',
  'TensorFlow',
  'PyTorch',
  'OpenCV',
  'Matplotlib',
  'Streamlit',
  'PostgreSQL',
  'Power BI',
  'JavaScript',
  'TypeScript',
  'Kubernetes',
  'Spring Boot',
  'REST API',
  'GraphQL',
  'Terraform',
  'CloudFormation',
  'Elasticsearch',
  'Prometheus',
  'Grafana',
  'Jenkins',
  'CircleCI',
  'GitLab CI',
  'GitHub Actions',
  'Ansible',
  'Helm',
  'Docker',
  'OpenShift',
  'BigQuery',
  'Snowflake',
  'Hadoop',
  'Spark',
  'Kafka',
  'RabbitMQ',
  'Redis',
  'MongoDB',
  'MySQL',
  'SQLite',
  'Oracle',
  'FastAPI',
  'Node.js',
  'Spring',
  'Django',
  'Flask',
  'Hibernate',
  'JUnit',
  'Selenium',
  'Cypress',
  'Pandas',
  'NumPy',
  'Keras',
  'Jupyter',
  'Tableau',
  'Excel',
  'Linux',
  'Ubuntu',
  'Bash',
  'Shell Scripting',
  'PowerShell',
  'Maven',
  'Gradle',
  'Nginx',
  'Apache',
  'Tomcat',
  'Azure',
  'GitHub',
  'GitLab',
  'Bitbucket',
  'CI/CD',
  'DevOps',
  'SAP UI5',
  'SAP Fiori',
  'ABAP',
  'SRE',
  'HTML',
  'CSS',
  'Kotlin',
  'Scala',
  'Ruby',
  'PHP',
  'C#',
  '.NET',
  'C++',
  'FAISS',
  'SMOTE',
  'NLP',
  'CNN',
  'SVM',
  'AWS',
  'GCP',
  'SQL',
  'DSA',
  'Git',
  'Go',
] as const

/** Phrases used only for resume skill extraction (catalog tech skills + extras). */
export const RESUME_TECHNICAL_SKILL_PHRASES = Array.from(
  new Set(
    [...SKILLS, ...EXTRA_TECHNICAL_SKILLS].filter((skill) => !NON_TECHNICAL_SKILLS.has(skill.toLowerCase())),
  ),
).sort((a, b) => b.length - a.length)

export function isTechnicalResumeSkill(skill: string) {
  const key = skill.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key || key.length < 2) return false
  if (NON_TECHNICAL_SKILLS.has(key)) return false
  return true
}

export function filterTechnicalResumeSkills(skills: readonly string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of skills) {
    const skill = raw.trim().replace(/\s+/g, ' ')
    if (!isTechnicalResumeSkill(skill)) continue
    const key = skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(skill)
  }
  return out
}

function grounded(term: string, rawLower: string) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9+#./])${escaped}([^a-z0-9+#./]|$)`).test(rawLower)
}

/** Match technical skills written in resume text. Soft skills are never returned. */
export function extractTechnicalSkillsFromText(resumeText: string, limit = 20) {
  const rawLower = ` ${resumeText.toLowerCase().replace(/\s+/g, ' ')} `
  const found: string[] = []
  const seen = new Set<string>()
  for (const skill of RESUME_TECHNICAL_SKILL_PHRASES) {
    if (!grounded(skill, rawLower)) continue
    const key = skill.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    found.push(skill)
    if (found.length >= limit) break
  }
  return found
}
