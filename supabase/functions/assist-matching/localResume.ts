const NON_TECHNICAL = new Set([
  "communication",
  "communications",
  "verbal communication",
  "written communication",
  "leadership",
  "teamwork",
  "collaboration",
  "problem solving",
  "critical thinking",
  "time management",
  "adaptability",
  "creativity",
  "presentation",
  "presentations",
  "mentoring",
  "management",
  "stakeholder management",
  "product sense",
  "agile",
  "scrum",
  "kanban",
  "english",
  "hindi",
  "spanish",
  "performance optimization",
  "debugging",
  "technical specifications",
  "unit testing",
  "defect resolution",
  "transport management",
  "production deployment",
]);

const SKILL_PHRASES = [
  "Distributed Systems",
  "Logistic Regression",
  "Linear Regression",
  "Machine Learning",
  "Random Forest",
  "Decision Tree",
  "System Design",
  "Scikit-learn",
  "Microservices",
  "Deep Learning",
  "Support Vector Machine",
  "Natural Language Processing",
  "Computer Vision",
  "Data Analysis",
  "GitHub Actions",
  "Shell Scripting",
  "Spring Boot",
  "CloudFormation",
  "Elasticsearch",
  "Power BI",
  "JavaScript",
  "TypeScript",
  "Kubernetes",
  "PostgreSQL",
  "TensorFlow",
  "PyTorch",
  "Matplotlib",
  "Streamlit",
  "MongoDB",
  "BigQuery",
  "Snowflake",
  "FastAPI",
  "Node.js",
  "Prometheus",
  "Terraform",
  "OpenShift",
  "Hibernate",
  "Selenium",
  "PowerShell",
  "Bitbucket",
  "CircleCI",
  "GitLab CI",
  "REST APIs",
  "REST API",
  "GraphQL",
  "RabbitMQ",
  "Ansible",
  "Grafana",
  "Jenkins",
  "Cypress",
  "Ubuntu",
  "Maven",
  "Gradle",
  "Nginx",
  "Apache",
  "Tomcat",
  "Azure",
  "DevOps",
  "React Native",
  "Next.js",
  "Vue.js",
  "NestJS",
  "Flutter",
  "Firebase",
  "Prisma",
  "Tailwind CSS",
  "Playwright",
  "Jest",
  "React",
  "Python",
  "Java",
  "Pandas",
  "NumPy",
  "Excel",
  "Docker",
  "OpenCV",
  "GitHub",
  "GitLab",
  "Tableau",
  "Hadoop",
  "Spark",
  "Kafka",
  "Django",
  "Flask",
  "Spring",
  "MySQL",
  "SQLite",
  "Oracle",
  "Linux",
  "Redis",
  "Helm",
  "Bash",
  "Kotlin",
  "Scala",
  "JUnit",
  "Figma",
  "Keras",
  "Jupyter",
  "FAISS",
  "SMOTE",
  "HTML",
  "CSS",
  "AWS",
  "GCP",
  "SQL",
  "NLP",
  "CNN",
  "SVM",
  "DSA",
  "Git",
  "PHP",
  "Ruby",
  "C#",
  ".NET",
  "CI/CD",
  "SRE",
  "Go",
  "C++",
  "SAP Business Application Studio",
  "SAP S/4HANA",
  "ABAP on HANA",
  "ABAP Objects",
  "SAP Gateway",
  "SAP Fiori",
  "SAP UI5",
  "SAP ABAP",
  "SAP BTP",
  "SAP ECC",
  "SAP GUI",
  "Eclipse ADT",
  "Enhancement Framework",
  "Customer Exits",
  "User Exits",
  "Adobe Forms",
  "Smart Forms",
  "Classical Reports",
  "OO ALV",
  "CDS Views",
  "OData V2",
  "OData V4",
  "OOABAP",
  "BAdIs",
  "BAPI",
  "IDoc",
  "AMDP",
  "ALV",
  "RAP",
  "RFC",
  "SOAP",
  "Proxy",
  "OData",
  "CDS",
  "ATC",
  "ABAP",
].filter((skill) => !NON_TECHNICAL.has(skill.toLowerCase()));

const SKILLS_SECTION_START =
  /(?:technical\s+skills|skills\s*(?:&|and|\/)\s*technologies|core\s+skills|key\s+skills|skills|technologies|tech\s+stack|technical\s+competencies|tools\s*(?:&|and)\s*technologies)\b/i;
const SKILLS_SECTION_STOP =
  /\b(?:professional\s+experience|work\s+experience|employment|experience|education|selected\s+technical\s+projects|projects|certifications|achievements|awards|publications|summary|profile)\b/i;


const FREEFORM_NOISE =
  /\b(developed|implemented|worked|responsible|experience|years|proficient|strong|knowledge|familiar|using|including|helped|supported|collaborated|led|managed|designed|built|created|improved|optimized)\b/i;
const SECTION_LABEL_NOISE =
  /^(programming|languages|frameworks|libraries|databases|cloud|devops|tools|platforms|sap technologies|development tools|enhancements|interfaces|reports|forms|sap modules|other skills|skills|technologies|tech stack)$/i;
const KNOWN_SKILL_KEYS = new Set(SKILL_PHRASES.map((skill) => skill.toLowerCase()));

function looksLikeTechnicalFreeformSkill(skill) {
  const cleaned = skill.trim().replace(/\s+/g, " ");
  const key = cleaned.toLowerCase();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return false;
  if (NON_TECHNICAL.has(key)) return false;
  if (cleaned.split(" ").length > 5) return false;
  if (FREEFORM_NOISE.test(cleaned)) return false;
  if (SECTION_LABEL_NOISE.test(cleaned)) return false;
  if (/^v?\d+(\.\d+)*$/i.test(cleaned)) return false;
  if (KNOWN_SKILL_KEYS.has(key)) return true;
  if (/[.#+/]/.test(cleaned)) return true;
  if (/^[A-Za-z][A-Za-z0-9+#.]{1,24}$/.test(cleaned)) return true;
  if (/^[A-Z]{2,}(?:\s+[A-Za-z0-9+#./-]+){0,3}$/.test(cleaned)) return true;
  if (/^[A-Za-z][A-Za-z0-9+#./-]*(?:\s+[A-Za-z][A-Za-z0-9+#./-]*){1,3}$/.test(cleaned)) return true;
  return false;
}

function normalizeResumePlainText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/(\w)\s*-\s+(\w)/g, "$1-$2")
    .replace(/([A-Za-z0-9])\s*\/\s*([A-Za-z0-9])/g, "$1/$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function projectTitle(chunk: string) {
  const name = chunk.replace(/\s+/g, " ").trim();
  const words = name.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 16) return "";
  if (name.length < 12 || name.length > 100) return "";
  if (!/\bproject\b/i.test(name)) return "";
  if (/\b(education|cgpa|percentage|school|college)\b/i.test(name)) return "";
  return name.slice(0, 120);
}

function grounded(term: string, rawLower: string, alnumHaystack: string) {
  const lower = term.trim().toLowerCase();
  if (lower.length < 2) return false;
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(^|[^a-z0-9+#./])${escaped}(s)?([^a-z0-9+#./]|$)`).test(rawLower)) return true;
  const tokens = lower.split(/[\s/]+/).filter(Boolean);
  const tail = tokens.at(-1) ?? "";
  if (tail.length >= 3 && tokens.length > 1) {
    const escTail = tail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`/(${escTail})(s)?([^a-z0-9+#./]|$)`).test(rawLower)) return true;
  }
  if (/[^a-z0-9]/i.test(lower)) {
    const alnumTerm = lower.replace(/[^a-z0-9]+/g, "");
    if (alnumTerm.length >= 4 && alnumHaystack.includes(alnumTerm)) return true;
  }
  return false;
}

function pushUnique(
  found: Array<Record<string, string>>,
  seen: Set<string>,
  skill: string,
  evidence: string,
  limit: number,
) {
  if (found.length >= limit) return false;
  const cleaned = skill.trim().replace(/\s+/g, " ");
  const key = cleaned.toLowerCase();
  if (cleaned.length < 2 || NON_TECHNICAL.has(key) || seen.has(key)) return true;
  for (const existing of seen) {
    if (existing.includes(key) && existing !== key) return true;
  }
  seen.add(key);
  found.push({
    skill: cleaned,
    category: "extracted",
    evidence_type: "skills_section",
    evidence_detail: evidence.slice(0, 160),
  });
  return found.length < limit;
}

function extractSkillsSectionTokens(normalized: string, limit: number) {
  const start = normalized.search(SKILLS_SECTION_START);
  if (start < 0) return [] as string[];
  const after = normalized.slice(start);
  const headingEnd = after.search(/[:\n]/);
  const bodyStart = headingEnd >= 0 ? headingEnd + 1 : after.length;
  let body = after.slice(bodyStart);
  const stop = body.search(SKILLS_SECTION_STOP);
  if (stop >= 0) body = body.slice(0, stop);
  body = body.slice(0, 2800).replace(/[A-Za-z][A-Za-z0-9 &/+.-]{0,40}:/g, ",");
  return body
    .split(/[,;•|/\n]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => {
      if (!looksLikeTechnicalFreeformSkill(part)) return false;
      if (/^(se\d{2}|st\d{2}|we\d{2}|bd\d{2}|sat)$/i.test(part)) return false;
      if (/^(sd|mm|fi|pp)$/i.test(part)) return false;
      if (/^(sql trace|performance optimization)$/i.test(part)) return false;
      return true;
    })
    .slice(0, limit);
}

/** Technical skills and projects copied from the resume text when the model is unavailable. */
export function localResumeSkillPlan(resumeText: string) {
  const normalized = normalizeResumePlainText(resumeText);
  const rawLower = ` ${normalized.toLowerCase().replace(/\s+/g, " ")} `;
  const alnumHaystack = rawLower.replace(/[^a-z0-9]+/g, "");
  const phrases = [...SKILL_PHRASES].sort((a, b) => b.length - a.length);
  const extractedSkills: Array<Record<string, string>> = [];
  const seen = new Set<string>();

  for (const skill of phrases) {
    if (!grounded(skill, rawLower, alnumHaystack)) continue;
    const at = rawLower.indexOf(skill.toLowerCase());
    const evidence = at >= 0
      ? rawLower.slice(Math.max(0, at - 30), at + skill.length + 50).trim()
      : "technical skills";
    if (!pushUnique(extractedSkills, seen, skill, evidence, 28)) break;
  }

  if (extractedSkills.length < 28) {
    for (const skill of extractSkillsSectionTokens(normalized, 28)) {
      if (!pushUnique(extractedSkills, seen, skill, "technical skills section", 28)) break;
    }
  }

  const projects: Array<Record<string, unknown>> = [];
  for (const chunk of resumeText.split(/[•|\n]/)) {
    const name = projectTitle(chunk);
    if (!name) continue;
    if (projects.some((project) => String(project.name).toLowerCase() === name.toLowerCase())) continue;
    projects.push({
      name: name.slice(0, 120),
      description: "",
      technologies: extractedSkills
        .map((item) => item.skill)
        .filter((skill) => name.toLowerCase().includes(skill.toLowerCase())),
    });
    if (projects.length >= 8) break;
  }

  if (extractedSkills.length === 0 && projects.length === 0) return null;
  return {
    profile_summary: "",
    extracted_skills: extractedSkills,
    inferred_skills: [],
    interview_topics: [],
    projects,
    experiences: [],
    certifications: [],
  };
}
