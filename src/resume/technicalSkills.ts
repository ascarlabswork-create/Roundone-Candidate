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
    'Performance Optimization',
    'Debugging',
    'Technical Specifications',
    'Unit Testing',
    'Defect Resolution',
    'Transport Management',
    'Production Deployment',
    'Requirements Gathering',
    'Cross Functional',
    'Self Motivated',
    'Hard Working',
    'Quick Learner',
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
  'REST APIs',
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
  'Playwright',
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
  'React Native',
  'React.js',
  'Next.js',
  'Vue.js',
  'Nuxt.js',
  'NestJS',
  'Express.js',
  'Redux',
  'Zustand',
  'Tailwind CSS',
  'Material UI',
  'Styled Components',
  'Webpack',
  'Vite',
  'Jest',
  'Vitest',
  'Storybook',
  'Flutter',
  'Dart',
  'SwiftUI',
  'Jetpack Compose',
  'Android SDK',
  'Xcode',
  'Firebase',
  'Supabase',
  'Prisma',
  'TypeORM',
  'Sequelize',
  'LangChain',
  'OpenAI',
  'Hugging Face',
  'Vector DB',
  'Pinecone',
  'Weaviate',
  'Airflow',
  'dbt',
  'Looker',
  'Snowflake',
  'Databricks',
  'Kafka Streams',
  'gRPC',
  'WebSockets',
  'WebRTC',
  'OAuth',
  'JWT',
  'SAML',
  'Okta',
  'Auth0',
  'Stripe',
  'PayPal',
  'Salesforce',
  'ServiceNow',
  'Workday',
  'SAP Business Application Studio',
  'SAP S/4HANA',
  'ABAP on HANA',
  'ABAP Objects',
  'SAP Gateway',
  'SAP Fiori',
  'SAP UI5',
  'SAP ABAP',
  'SAP BTP',
  'SAP ECC',
  'SAP GUI',
  'Eclipse ADT',
  'Enhancement Framework',
  'Customer Exits',
  'User Exits',
  'Adobe Forms',
  'Smart Forms',
  'Classical Reports',
  'OO ALV',
  'CDS Views',
  'OData V2',
  'OData V4',
  'OOABAP',
  'BAdIs',
  'BAPI',
  'IDoc',
  'AMDP',
  'ALV',
  'RAP',
  'RFC',
  'SOAP',
  'Proxy',
  'OData',
  'CDS',
  'ATC',
  'ABAP',
  'SRE',
  'HTML',
  'CSS',
  'Sass',
  'Less',
  'Kotlin',
  'Scala',
  'Ruby',
  'PHP',
  'C#',
  '.NET',
  'ASP.NET',
  'C++',
  'FAISS',
  'SMOTE',
  'NLP',
  'CNN',
  'SVM',
  'AWS',
  'GCP',
  'SQL',
  'NoSQL',
  'DSA',
  'Git',
  'Go',
  'R',
  'MATLAB',
] as const

/** Phrases used only for resume skill extraction (catalog tech skills + extras). */
export const RESUME_TECHNICAL_SKILL_PHRASES = Array.from(
  new Set(
    [...SKILLS, ...EXTRA_TECHNICAL_SKILLS].filter((skill) => !NON_TECHNICAL_SKILLS.has(skill.toLowerCase())),
  ),
).sort((a, b) => b.length - a.length)

const KNOWN_SKILL_KEYS = new Set(RESUME_TECHNICAL_SKILL_PHRASES.map((skill) => skill.toLowerCase()))

const SKILLS_SECTION_START =
  /(?:technical\s+skills|skills\s*(?:&|and|\/)\s*technologies|core\s+skills|key\s+skills|skills|technologies|tech\s+stack|technical\s+competencies|tools\s*(?:&|and)\s*technologies)\b/i
const SKILLS_SECTION_STOP =
  /\b(?:professional\s+experience|work\s+experience|employment|experience|education|selected\s+technical\s+projects|projects|certifications|achievements|awards|publications|summary|profile)\b/i

const FREEFORM_NOISE =
  /\b(developed|implemented|worked|responsible|experience|years|proficient|strong|knowledge|familiar|using|including|helped|supported|collaborated|led|managed|designed|built|created|improved|optimized)\b/i

const SECTION_LABEL_NOISE =
  /^(programming|languages|frameworks|libraries|databases|cloud|devops|tools|platforms|sap technologies|development tools|enhancements|interfaces|reports|forms|sap modules|other skills|skills|technologies|tech stack)$/i

/** Collapse PDF hyphenation / slash artifacts so skill phrases can match. */
export function normalizeResumePlainText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/(\w)\s*-\s+(\w)/g, '$1-$2')
    .replace(/([A-Za-z0-9])\s*\/\s*([A-Za-z0-9])/g, '$1/$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isTechnicalResumeSkill(skill: string) {
  const key = skill.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key || key.length < 2) return false
  if (NON_TECHNICAL_SKILLS.has(key)) return false
  return true
}

/** Free-form skills-section tokens must look like technologies, not sentence fragments. */
export function looksLikeTechnicalFreeformSkill(skill: string) {
  const cleaned = skill.trim().replace(/\s+/g, ' ')
  if (!isTechnicalResumeSkill(cleaned)) return false
  if (cleaned.length > 40) return false
  if (cleaned.split(' ').length > 5) return false
  if (FREEFORM_NOISE.test(cleaned)) return false
  if (SECTION_LABEL_NOISE.test(cleaned)) return false
  if (/^v?\d+(\.\d+)*$/i.test(cleaned)) return false
  if (KNOWN_SKILL_KEYS.has(cleaned.toLowerCase())) return true
  if (/[.#+/]/.test(cleaned)) return true
  if (/^[A-Za-z][A-Za-z0-9+#.]{1,24}$/.test(cleaned)) return true
  if (/^[A-Z]{2,}(?:\s+[A-Za-z0-9+#./-]+){0,3}$/.test(cleaned)) return true
  if (/^[A-Za-z][A-Za-z0-9+#./-]*(?:\s+[A-Za-z][A-Za-z0-9+#./-]*){1,3}$/.test(cleaned)) return true
  return false
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

function grounded(term: string, rawLower: string, alnumHaystack: string) {
  const lower = term.trim().toLowerCase()
  if (lower.length < 2) return false
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`(^|[^a-z0-9+#./])${escaped}(s)?([^a-z0-9+#./]|$)`).test(rawLower)) return true

  // Slash compounds like "Fiori/UI5" should still match catalog phrases ending in "UI5".
  const tokens = lower.split(/[\s/]+/).filter(Boolean)
  const tail = tokens.at(-1) ?? ''
  if (tail.length >= 3 && tokens.length > 1) {
    const escTail = tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`/(${escTail})(s)?([^a-z0-9+#./]|$)`).test(rawLower)) return true
  }

  // Only collapse punctuation for terms like Node.js / C++ / CI/CD.
  if (/[^a-z0-9]/i.test(lower)) {
    const alnumTerm = lower.replace(/[^a-z0-9]+/g, '')
    if (alnumTerm.length >= 4 && alnumHaystack.includes(alnumTerm)) return true
  }
  return false
}

function extractSkillsSectionBody(normalized: string) {
  const start = normalized.search(SKILLS_SECTION_START)
  if (start < 0) return ''
  const after = normalized.slice(start)
  const headingEnd = after.search(/[:\n]/)
  const bodyStart = headingEnd >= 0 ? headingEnd + 1 : after.length
  let body = after.slice(bodyStart)
  const stop = body.search(SKILLS_SECTION_STOP)
  if (stop >= 0) body = body.slice(0, stop)
  return body.slice(0, 3200)
}

function extractSkillsSectionTokens(normalized: string, limit: number) {
  const body = extractSkillsSectionBody(normalized)
  if (!body) return [] as string[]
  const withoutLabels = body.replace(/[A-Za-z][A-Za-z0-9 &/+.-]{0,40}:/g, ',')
  const parts = withoutLabels
    .split(/[,;•|/\n]+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const found: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    if (!looksLikeTechnicalFreeformSkill(part)) continue
    if (/^(se\d{2}|st\d{2}|we\d{2}|bd\d{2}|sat)$/i.test(part)) continue
    if (/^(sd|mm|fi|pp)$/i.test(part)) continue
    if (/^(sql trace|performance optimization)$/i.test(part)) continue
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    found.push(part)
    if (found.length >= limit) break
  }
  return found
}

/** Match technical skills written in resume text. Soft skills are never returned. */
export function extractTechnicalSkillsFromText(resumeText: string, limit = 36) {
  const normalized = normalizeResumePlainText(resumeText)
  const rawLower = ` ${normalized.toLowerCase().replace(/\s+/g, ' ')} `
  const alnumHaystack = rawLower.replace(/[^a-z0-9]+/g, '')
  const sectionBody = extractSkillsSectionBody(normalized).toLowerCase()
  const ranked: { skill: string; score: number }[] = []
  const seen = new Set<string>()

  for (const skill of RESUME_TECHNICAL_SKILL_PHRASES) {
    if (!grounded(skill, rawLower, alnumHaystack)) continue
    const key = skill.toLowerCase()
    if (seen.has(key) || !isTechnicalResumeSkill(skill)) continue
    // Prefer skills listed in the dedicated skills section, then longer phrases.
    // Short section skills (SQL, Git) get a small boost so they are not crowded out.
    const inSection = sectionBody.includes(key)
    ranked.push({
      skill,
      score: (inSection ? 1000 : 0) + (inSection && skill.length <= 12 ? 40 : 0) + skill.length,
    })
    seen.add(key)
  }

  for (const skill of extractSkillsSectionTokens(normalized, limit * 2)) {
    const key = skill.toLowerCase()
    if (seen.has(key) || !isTechnicalResumeSkill(skill)) continue
    // Skip short forms already covered by a longer accepted skill (ABAP vs SAP ABAP).
    if ([...seen].some((existing) => existing.includes(key) && existing !== key)) continue
    ranked.push({ skill, score: 900 + skill.length })
    seen.add(key)
  }

  ranked.sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill))
  const compact: string[] = []
  for (const item of ranked) {
    const key = item.skill.toLowerCase()
    // Keep the higher-ranked form when two skills overlap (SAP ABAP vs ABAP, REST APIs vs REST).
    if (
      compact.some((existing) => {
        const other = existing.toLowerCase()
        return other === key || other.includes(key) || key.includes(other)
      })
    ) {
      continue
    }
    compact.push(item.skill)
    if (compact.length >= limit) break
  }
  return compact
}
