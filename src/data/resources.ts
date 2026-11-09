export type ResourceKind = 'Guide' | 'Template' | 'Checklist' | 'Drill' | 'Article'

export type CandidateResource = {
  id: string
  kind: ResourceKind
  title: string
  summary: string
  minutes: number
  /** Role names or fragments this helps with. Empty = useful for most candidates. */
  roles: string[]
  /** Skills / topics this helps with. */
  skills: string[]
  /** Interview rounds this helps with. */
  interviewTypes: string[]
  /** Short actionable body the candidate can use immediately. */
  steps: string[]
  /** In-app next action when it makes sense. */
  action?: { label: string; to: string }
}

/**
 * Curated candidate resources. Matched to a profile by role, skills, and interview type.
 * Keep copy practical — no filler CMS placeholders.
 */
export const CANDIDATE_RESOURCES: CandidateResource[] = [
  {
    id: 'system-design-45',
    kind: 'Guide',
    title: 'Run a 45-minute system design like a hiring loop',
    summary: 'Clarify requirements, lock a high-level design, then go deep on 1–2 risks instead of drawing everything.',
    minutes: 6,
    roles: ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer', 'Staff', 'SDE'],
    skills: ['System Design', 'Distributed Systems', 'Microservices', 'AWS', 'GCP', 'Azure', 'Kafka'],
    interviewTypes: ['System Design'],
    steps: [
      'Minute 0–5: restate the goal, users, scale, and what is out of scope. Ask 3 clarifying questions.',
      'Minute 5–15: draw clients → API → services → storage. Name the consistency and latency target.',
      'Minute 15–30: deep-dive one hard path (hot keys, fan-out, search, auth). Discuss failure modes.',
      'Minute 30–40: scale bottlenecks, caching, queues, and what you would measure in production.',
      'Minute 40–45: summarize trade-offs and what you would build in v1 vs v2.',
    ],
    action: { label: 'Practice System Design with AI', to: '/candidate/practice/mock?fresh=1&type=System%20Design' },
  },
  {
    id: 'coding-narration',
    kind: 'Guide',
    title: 'Talk through a coding round without freezing',
    summary: 'Interviewers score clarity as much as the final code. Use a fixed speak-then-code rhythm.',
    minutes: 5,
    roles: ['Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'Full Stack Engineer', 'SDE'],
    skills: ['DSA', 'Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'Go'],
    interviewTypes: ['Coding'],
    steps: [
      'Restate the problem and an example input/output before writing code.',
      'State brute force first, then the target complexity you will aim for.',
      'Name your data structures out loud, then implement in small chunks.',
      'Walk one happy path and one edge case before you say you are done.',
      'If stuck for 90 seconds, narrate what you are testing next — silence looks worse than a partial idea.',
    ],
    action: { label: 'Start a coding AI interview', to: '/candidate/practice/mock?fresh=1&type=Coding' },
  },
  {
    id: 'behavioral-star',
    kind: 'Template',
    title: 'STAR stories you can reuse in any behavioral round',
    summary: 'Prepare 5 stories once, then remap them to leadership, conflict, failure, ownership, and impact.',
    minutes: 7,
    roles: ['Software Engineer', 'Engineering Manager', 'Product Manager', 'SDE', 'Lead'],
    skills: [],
    interviewTypes: ['Behavioral'],
    steps: [
      'Pick 5 real stories: a conflict, a failure, a delivery under pressure, mentoring, and a technical decision.',
      'For each: Situation (2 lines), Task (1 line), Actions you personally took (bullet the verbs), Result with a metric.',
      'Add one “what I would do differently” sentence — that is often the follow-up.',
      'Practice saying each story in under 2 minutes. Cut company jargon.',
      'Map each story to 2–3 common prompts so you are never inventing under pressure.',
    ],
    action: { label: 'Practice a behavioral AI interview', to: '/candidate/practice/mock?fresh=1&type=Behavioral' },
  },
  {
    id: 'mock-scorecard',
    kind: 'Template',
    title: 'Scorecard to fill after every mock',
    summary: 'Turn vague feedback into a next-session plan. Use the same sheet for live and AI mocks.',
    minutes: 4,
    roles: [],
    skills: [],
    interviewTypes: [],
    steps: [
      'Overall bar: Strong hire / Hire / Lean hire / No — and why in one sentence.',
      'Score 1–5 on: problem solving, technical depth, communication, structure.',
      'List 2 strengths to keep and 2 gaps that blocked a higher score.',
      'Write one drill for the next 48 hours (one skill, one exercise, one time box).',
      'Book the next mock only after that drill is done — otherwise you repeat the same miss.',
    ],
    action: { label: 'Find a live interviewer', to: '/candidate/find' },
  },
  {
    id: 'ml-interview-loop',
    kind: 'Guide',
    title: 'What an ML interview loop usually probes',
    summary: 'Separate modeling questions from ML system design so you do not mix answers.',
    minutes: 6,
    roles: ['ML Engineer', 'AI Engineer', 'Data Scientist', 'Machine Learning'],
    skills: ['Machine Learning', 'PyTorch', 'TensorFlow', 'NLP', 'Deep Learning', 'Pandas', 'NumPy'],
    interviewTypes: ['Machine Learning', 'Data Science'],
    steps: [
      'Modeling: problem framing, metrics, leakage, baseline vs model choice, and failure cases.',
      'Feature / data: labeling quality, imbalance, and how you would monitor drift.',
      'ML system design: training vs serving path, latency, feature store, and rollback.',
      'Keep a “production story” ready: a model you shipped, the metric that moved, and what broke.',
      'Practice explaining trade-offs without jargon — clarity beats fancy architecture drawings.',
    ],
    action: { label: 'Practice an ML AI interview', to: '/candidate/practice/mock?fresh=1&type=Machine%20Learning' },
  },
  {
    id: 'data-sql-case',
    kind: 'Drill',
    title: 'SQL + experiment case warm-up',
    summary: 'A 20-minute drill that mirrors data science / analytics interview pressure.',
    minutes: 4,
    roles: ['Data Scientist', 'Data Analyst', 'Data Engineer'],
    skills: ['SQL', 'Pandas', 'Excel', 'Power BI', 'Tableau'],
    interviewTypes: ['Data Science'],
    steps: [
      'Pick a metric (activation, retention, revenue) and define numerator/denominator carefully.',
      'Write the SQL shape out loud before coding: grain, joins, filters, then aggregation.',
      'State one confounder for an A/B test and how you would check significance.',
      'End with “what I would look at next week” — interviewers want product judgment, not only queries.',
    ],
    action: { label: 'Practice a data AI interview', to: '/candidate/practice/mock?fresh=1&type=Data%20Science' },
  },
  {
    id: 'devops-incident',
    kind: 'Checklist',
    title: 'DevOps / SRE interview checklist',
    summary: 'Incident, CI/CD, and infra questions show up together. Prep a single production story that covers all three.',
    minutes: 5,
    roles: ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Engineer', 'Platform'],
    skills: ['Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'CI/CD', 'Linux', 'Jenkins'],
    interviewTypes: ['Coding', 'System Design'],
    steps: [
      'Prepare one incident: detection → mitigation → root cause → prevention.',
      'Be ready to sketch a CI/CD pipeline and where you would add tests, gates, and rollbacks.',
      'Explain one infra-as-code choice and a failure you caught before prod.',
      'Know your observability stack: logs, metrics, traces — and what alert you would wake up for.',
    ],
    action: { label: 'Find a DevOps interviewer', to: '/candidate/find' },
  },
  {
    id: 'frontend-loop',
    kind: 'Guide',
    title: 'Frontend interview: UI, state, and performance',
    summary: 'Most frontend loops bounce between coding, component design, and performance debugging.',
    minutes: 5,
    roles: ['Frontend Engineer', 'Full Stack Engineer', 'UI'],
    skills: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Next.js'],
    interviewTypes: ['Coding', 'System Design'],
    steps: [
      'For UI coding: clarify states (loading, empty, error) before writing JSX.',
      'For component design: props vs state, composition, and accessibility basics.',
      'For performance: name the metric (LCP, TTI) and one concrete fix you have shipped.',
      'Keep a story about a hard rendering/state bug and how you isolated it.',
    ],
    action: { label: 'Practice with AI', to: '/candidate/practice/mock?fresh=1&type=Coding&skills=React%2CTypeScript' },
  },
  {
    id: 'product-sense',
    kind: 'Guide',
    title: 'Product interview: structure before opinions',
    summary: 'Strong product answers start with user, goal, and metric — then ideas.',
    minutes: 5,
    roles: ['Product Manager', 'Product'],
    skills: ['Product Sense'],
    interviewTypes: ['Product'],
    steps: [
      'Clarify the user, the job-to-be-done, and the success metric before brainstorming.',
      'Generate 3 ideas, pick 1 with a clear why, then walk through launch risks.',
      'Always include how you would measure and what would make you kill the idea.',
      'Practice with a familiar product so you can go deep instead of inventing features.',
    ],
    action: { label: 'Practice a product AI interview', to: '/candidate/practice/mock?fresh=1&type=Product' },
  },
  {
    id: 'two-week-plan',
    kind: 'Template',
    title: 'Turn feedback into a two-week plan',
    summary: 'After a weak mock, do not book another mock immediately. Close the gap first.',
    minutes: 5,
    roles: [],
    skills: [],
    interviewTypes: [],
    steps: [
      'Day 1: rewrite the scorecard gaps into 2 concrete skills (example: “SQL window functions”, “STAR conflict story”).',
      'Days 2–5: one focused drill per day, 45–60 minutes, same skill only.',
      'Day 6: AI mock on only those skills. Capture new gaps.',
      'Days 7–12: live or AI practice alternating with drills. Keep a short log of misses.',
      'Day 13–14: one full mock at target difficulty. Decide hire-bar progress before scheduling more.',
    ],
    action: { label: 'Open AI practice', to: '/candidate/practice' },
  },
  {
    id: 'resume-to-questions',
    kind: 'Checklist',
    title: 'Make interviewers ask about your real projects',
    summary: 'If your resume skills are vague, both AI and human interviewers will invent generic questions.',
    minutes: 4,
    roles: [],
    skills: [],
    interviewTypes: [],
    steps: [
      'Extract technical skills from your resume and drop soft skills.',
      'For each top project, write: problem, your role, tech used, result.',
      'Mark 3 “deep dive” projects you can talk about for 8–10 minutes.',
      'Use those skills when you start AI practice or book a live interviewer.',
    ],
    action: { label: 'Build skills from resume', to: '/candidate/resume-skills' },
  },
  {
    id: 'sde2-bar',
    kind: 'Article',
    title: 'What “SDE 2 bar” usually means in mocks',
    summary: 'SDE 2 is less about clever tricks and more about independent ownership and clear trade-offs.',
    minutes: 5,
    roles: ['SDE 2', 'Software Engineer', 'Backend Engineer', 'Full Stack Engineer'],
    skills: ['System Design', 'DSA'],
    interviewTypes: ['Coding', 'System Design', 'Behavioral'],
    steps: [
      'Coding: correct solution plus complexity talk, edge cases, and clean structure without hand-holding.',
      'Design: you drive the conversation, call out bottlenecks, and defend trade-offs.',
      'Behavioral: scope ownership beyond tickets — mentoring, incidents, cross-team delivery.',
      'In mocks, ask your interviewer where you were below that bar, not just “how did I do?”.',
    ],
    action: { label: 'Book a live mock', to: '/candidate/find' },
  },
]

export type ResourceProfileSignal = {
  role?: string | null
  level?: string | null
  skills?: string[]
  interviewType?: string | null
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function overlaps(haystack: string[], needle: string) {
  const n = normalize(needle)
  if (!n) return false
  return haystack.some((item) => {
    const h = normalize(item)
    return h === n || h.includes(n) || n.includes(h)
  })
}

/** Score how well a resource matches the candidate's current prep focus. */
export function scoreResource(resource: CandidateResource, signal: ResourceProfileSignal) {
  let score = 0
  const role = signal.role?.trim() ?? ''
  const level = signal.level?.trim() ?? ''
  const interviewType = signal.interviewType?.trim() ?? ''
  const skills = (signal.skills ?? []).map((item) => item.trim()).filter(Boolean)

  if (role && overlaps(resource.roles, role)) score += 5
  if (level && overlaps(resource.roles, level)) score += 2
  if (interviewType && overlaps(resource.interviewTypes, interviewType)) score += 4

  for (const skill of skills) {
    if (overlaps(resource.skills, skill)) score += 3
  }

  // Universal templates stay visible but ranked below strong matches.
  if (resource.roles.length === 0 && resource.skills.length === 0 && resource.interviewTypes.length === 0) {
    score += 1
  }

  return score
}

export function rankResourcesForCandidate(signal: ResourceProfileSignal, limit = 6) {
  return [...CANDIDATE_RESOURCES]
    .map((resource) => ({ resource, score: scoreResource(resource, signal) }))
    .sort((a, b) => b.score - a.score || a.resource.title.localeCompare(b.resource.title))
    .slice(0, limit)
}

export function filterResources(signal: {
  kind?: ResourceKind | 'All'
  query?: string
}) {
  const kind = signal.kind ?? 'All'
  const query = normalize(signal.query ?? '')
  return CANDIDATE_RESOURCES.filter((resource) => {
    if (kind !== 'All' && resource.kind !== kind) return false
    if (!query) return true
    const hay = [resource.title, resource.summary, ...resource.skills, ...resource.roles, ...resource.interviewTypes]
      .join(' ')
      .toLowerCase()
    return hay.includes(query)
  })
}
