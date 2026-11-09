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
].filter((skill) => !NON_TECHNICAL.has(skill.toLowerCase()));

function projectTitle(chunk: string) {
  const name = chunk.replace(/\s+/g, " ").trim();
  const words = name.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 16) return "";
  if (name.length < 12 || name.length > 100) return "";
  if (!/\bproject\b/i.test(name)) return "";
  if (/\b(education|cgpa|percentage|school|college)\b/i.test(name)) return "";
  return name.slice(0, 120);
}

function grounded(term: string, rawLower: string) {
  const lower = term.trim().toLowerCase();
  if (lower.length < 2) return false;
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#./])${escaped}([^a-z0-9+#./]|$)`).test(rawLower);
}

/** Technical skills and projects copied from the resume text when the model is unavailable. */
export function localResumeSkillPlan(resumeText: string) {
  const rawLower = ` ${resumeText.toLowerCase().replace(/\s+/g, " ")} `;
  const phrases = [...SKILL_PHRASES].sort((a, b) => b.length - a.length);
  const extractedSkills: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  for (const skill of phrases) {
    if (!grounded(skill, rawLower)) continue;
    const key = skill.toLowerCase();
    if (seen.has(key) || NON_TECHNICAL.has(key)) continue;
    seen.add(key);
    const at = rawLower.indexOf(key);
    const evidence = rawLower.slice(Math.max(0, at - 30), at + key.length + 50).trim();
    extractedSkills.push({
      skill,
      category: "extracted",
      evidence_type: "skills_section",
      evidence_detail: evidence.slice(0, 160),
    });
    if (extractedSkills.length >= 20) break;
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
