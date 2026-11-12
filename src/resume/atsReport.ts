import {
  evaluateAtsReadiness,
  evaluateJdMatch,
  normalizeResumeText,
  type AtsReadinessResult,
  type JdMatchResult,
} from './atsCheck.ts'
import { extractTechnicalSkillsFromText } from './technicalSkills.ts'

export type AtsIssue = {
  id: string
  category: 'content' | 'sections' | 'ats'
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
}

export type AtsCategoryScore = {
  id: 'content' | 'sections' | 'ats'
  label: string
  score: number
  issueCount: number
}

export type AtsFullReport = {
  readiness: AtsReadinessResult
  parseRate: number
  categories: AtsCategoryScore[]
  issues: AtsIssue[]
  issueCount: number
  jdMatch: JdMatchResult | null
}

function scoreFromFlags(flags: boolean[]) {
  if (flags.length === 0) return 100
  const ok = flags.filter(Boolean).length
  return Math.round((ok / flags.length) * 100)
}

/** Richer candidate-facing report inspired by ATS checkers — grounded in resume text only. */
export function buildAtsFullReport(resumeText: string, jobDescription = '', jobTitle = ''): AtsFullReport {
  const text = normalizeResumeText(resumeText)
  const readiness = evaluateAtsReadiness(text)
  const words = readiness.wordCount
  const tech = extractTechnicalSkillsFromText(text, 30)
  const metrics = (
    text.match(
      /\b\d+(\.\d+)?\s?(?:%|x|k\+?|m\+?|million|billion|users|requests|latency|ms|sec|hrs?|hours?|days?|weeks?|months?|servers?|pipelines?)(?!\w)|\b\d+\+?\s+years?\b/gi,
    ) ?? []
  ).length
  // Prefer real newlines; for flattened PDFs, treat long sentences as “lines”.
  const newlineLong = text.split('\n').filter((line) => line.trim().length > 160).length
  const sentenceLong =
    text.split('\n').length <= 3
      ? (text.match(/[^.!?\n]{170,}[.!?]?/g) ?? []).length
      : 0
  const longLines = Math.max(newlineLong, sentenceLong)
  const repeatedWords = countHeavyRepetition(text)

  const issues: AtsIssue[] = []
  for (const item of readiness.items) {
    if (item.passed) continue
    const category: AtsIssue['category'] =
      item.id.startsWith('contact') || item.id === 'tech-keywords' || item.id === 'length' || item.id === 'bullets' || item.id === 'dates'
        ? 'ats'
        : item.id.includes('section')
          ? 'sections'
          : 'content'
    issues.push({
      id: item.id,
      category,
      title: item.label,
      detail: item.detail,
      severity: item.weight >= 14 ? 'high' : item.weight >= 10 ? 'medium' : 'low',
    })
  }
  if (metrics < 2) {
    issues.push({
      id: 'impact',
      category: 'content',
      title: 'Quantifying impact',
      detail: 'Add measurable outcomes (%, users, latency, cost) under recent roles.',
      severity: 'medium',
    })
  }
  if (longLines >= 4) {
    issues.push({
      id: 'wordiness',
      category: 'content',
      title: 'Wordiness & readability',
      detail: 'Some lines are very long. Keep bullets under ~2 lines so recruiters can scan quickly.',
      severity: 'medium',
    })
  }
  if (repeatedWords >= 3) {
    issues.push({
      id: 'repetition',
      category: 'content',
      title: 'Repetition',
      detail: 'The same filler words repeat often. Vary verbs (built, led, improved, automated).',
      severity: 'low',
    })
  }
  if (tech.length < 5) {
    issues.push({
      id: 'keyword-density',
      category: 'ats',
      title: 'Keyword coverage',
      detail: 'Name concrete tools from your work so parsers and humans see the match.',
      severity: 'high',
    })
  }

  const sectionFlags = readiness.items.filter((item) => item.id.includes('section')).map((item) => item.passed)
  const atsFlags = readiness.items
    .filter((item) => ['contact-email', 'contact-phone', 'length', 'bullets', 'dates', 'tech-keywords'].includes(item.id))
    .map((item) => item.passed)
  const contentFlags = [metrics >= 2, longLines < 4, repeatedWords < 3, words >= 120]

  const categories: AtsCategoryScore[] = [
    {
      id: 'content',
      label: 'Content',
      score: scoreFromFlags(contentFlags),
      issueCount: issues.filter((issue) => issue.category === 'content').length,
    },
    {
      id: 'sections',
      label: 'Sections',
      score: scoreFromFlags(sectionFlags),
      issueCount: issues.filter((issue) => issue.category === 'sections').length,
    },
    {
      id: 'ats',
      label: 'ATS essentials',
      score: scoreFromFlags(atsFlags),
      issueCount: issues.filter((issue) => issue.category === 'ats').length,
    },
  ]

  const parseBase = readiness.score
  const parseRate = Math.max(35, Math.min(98, Math.round(parseBase * 0.9 + (tech.length >= 5 ? 8 : 0) + (metrics >= 2 ? 4 : 0))))

  const jdMatch =
    jobDescription.trim().length >= 40 ? evaluateJdMatch(resumeText, jobDescription, jobTitle, []) : null

  return {
    readiness,
    parseRate,
    categories,
    issues,
    issueCount: issues.length,
    jdMatch,
  }
}

function countHeavyRepetition(text: string) {
  const fillers = ['responsible for', 'worked on', 'helped with', 'various', 'etc']
  let hits = 0
  const lower = text.toLowerCase()
  for (const phrase of fillers) {
    const matches = lower.match(new RegExp(phrase.replace(/\s+/g, '\\s+'), 'g'))
    if ((matches?.length ?? 0) >= 2) hits += 1
  }
  return hits
}
