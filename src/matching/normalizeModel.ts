import type { MatchingAiNormalized } from './aiModel.ts'
import { normalizeSkill } from './skillCanonical.ts'

export const NORMALIZATION_AI_MODE = 'normalize' as const

/** High-confidence values can be shown as a direct suggestion. */
export const NORMALIZATION_HIGH_CONFIDENCE = 0.85
/** Medium-confidence values are shown only as a confirmation suggestion. */
export const NORMALIZATION_MEDIUM_CONFIDENCE = 0.6

export type ConfidenceBand = 'high' | 'medium'

export type NormalizedField = {
  value: string
  confidence: number
}

export type MatchingVocabulary = {
  roles: string[]
  skills: string[]
  interviewTypes: string[]
  candidateLevels: string[]
  companies: string[]
}

export type NormalizationInput = {
  targetRole: string
  candidateLevel: string
  skills: string[]
  interviewType: string
  targetCompany: string
  intent: string
}

export type NormalizationAiResponse = {
  targetRole: NormalizedField | null
  candidateLevel: NormalizedField | null
  skills: NormalizedField[]
  interviewType: NormalizedField | null
  targetCompany: NormalizedField | null
}

export type UsableNormalizedField = NormalizedField & {
  band: ConfidenceBand
}

export type UsableNormalization = {
  targetRole: UsableNormalizedField | null
  candidateLevel: UsableNormalizedField | null
  interviewType: UsableNormalizedField | null
  targetCompany: UsableNormalizedField | null
  skills: UsableNormalizedField[]
}

export type NormalizationPatch = {
  targetRole?: string
  candidateLevel?: string
  interviewType?: string
  targetCompany?: string
  skills?: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readTrimmed(value: unknown, max = 80) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function readConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > 1) return null
  return value
}

export function canonicalVocabularyValue(value: string, vocabulary: readonly string[]) {
  const needle = value.trim().toLowerCase()
  if (!needle) return null
  return vocabulary.find((item) => item.trim().toLowerCase() === needle) ?? null
}

export function confidenceBand(confidence: number): ConfidenceBand | null {
  if (confidence >= NORMALIZATION_HIGH_CONFIDENCE) return 'high'
  if (confidence >= NORMALIZATION_MEDIUM_CONFIDENCE) return 'medium'
  return null
}

function parseNormalizedField(value: unknown, vocabulary: readonly string[], max = 80): NormalizedField | null {
  const row = asRecord(value)
  if (!row) return null
  const canonical = canonicalVocabularyValue(readTrimmed(row.value, max), vocabulary)
  const confidence = readConfidence(row.confidence)
  if (!canonical || confidence == null) return null
  return { value: canonical, confidence }
}

export function parseNormalizationAiResponse(
  value: unknown,
  vocabulary: MatchingVocabulary,
): NormalizationAiResponse | null {
  const row = asRecord(value)
  if (!row) return null

  const skillsRaw = Array.isArray(row.skills) ? row.skills : []
  const skills: NormalizedField[] = []
  for (const item of skillsRaw) {
    const parsed = parseNormalizedField(item, vocabulary.skills, 40)
    if (!parsed) continue
    if (skills.some((existing) => existing.value.toLowerCase() === parsed.value.toLowerCase())) continue
    skills.push(parsed)
    if (skills.length >= 8) break
  }

  return {
    targetRole: parseNormalizedField(row.target_role ?? row.targetRole, vocabulary.roles, 80),
    candidateLevel: parseNormalizedField(row.candidate_level ?? row.candidateLevel, vocabulary.candidateLevels, 40),
    skills,
    interviewType: parseNormalizedField(row.interview_type ?? row.interviewType, vocabulary.interviewTypes, 60),
    targetCompany: parseNormalizedField(row.target_company ?? row.targetCompany, vocabulary.companies, 80),
  }
}

function toUsableField(field: NormalizedField | null, current: string): UsableNormalizedField | null {
  if (!field) return null
  const band = confidenceBand(field.confidence)
  if (!band) return null
  if (field.value.trim().toLowerCase() === current.trim().toLowerCase()) return null
  return { ...field, band }
}

type RoleSkillSignal = {
  role: string
  interviewType: string
  /** Canonical skill keys that support this role. */
  skills: string[]
  /** Extra weight for distinctive tools in this family. */
  strongSkills?: string[]
}

/**
 * Deterministic role hints from skills. Prevents bad AI jumps like SQL + Power BI → ML Engineer.
 */
const ROLE_SKILL_SIGNALS: RoleSkillSignal[] = [
  {
    role: 'Data Analyst',
    interviewType: 'Data Science',
    skills: ['sql', 'excel', 'power bi', 'tableau', 'looker', 'power query', 'dax'],
    strongSkills: ['power bi', 'tableau', 'looker', 'excel', 'dax'],
  },
  {
    role: 'Data Scientist',
    interviewType: 'Data Science',
    skills: ['pandas', 'numpy', 'scikit-learn', 'statistics', 'r', 'jupyter notebook', 'sql'],
    strongSkills: ['pandas', 'numpy', 'scikit-learn', 'statistics', 'r'],
  },
  {
    role: 'ML Engineer',
    interviewType: 'Machine Learning',
    skills: [
      'machine learning',
      'pytorch',
      'tensorflow',
      'deep learning',
      'nlp',
      'llm',
      'scikit-learn',
      'keras',
      'huggingface',
    ],
    strongSkills: ['pytorch', 'tensorflow', 'deep learning', 'nlp', 'llm', 'machine learning', 'keras'],
  },
  {
    role: 'Data Engineer',
    interviewType: 'Data Science',
    skills: ['sql', 'spark', 'airflow', 'kafka', 'dbt', 'snowflake', 'databricks', 'etl', 'hadoop'],
    strongSkills: ['spark', 'airflow', 'kafka', 'dbt', 'snowflake', 'databricks', 'etl'],
  },
  {
    role: 'Frontend Engineer',
    interviewType: 'Coding',
    skills: ['react', 'typescript', 'javascript', 'next.js', 'html', 'css', 'vue', 'angular'],
    strongSkills: ['react', 'typescript', 'next.js', 'vue', 'angular'],
  },
  {
    role: 'Backend Engineer',
    interviewType: 'Coding',
    skills: ['java', 'python', 'go', 'node.js', 'fastapi', 'spring', 'django', 'postgresql', 'mongodb'],
    strongSkills: ['java', 'go', 'node.js', 'fastapi', 'spring', 'django'],
  },
  {
    role: 'DevOps Engineer',
    interviewType: 'Coding',
    skills: ['docker', 'kubernetes', 'terraform', 'aws', 'ci/cd', 'jenkins', 'linux', 'ansible'],
    strongSkills: ['docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins', 'ansible'],
  },
]

function skillSignalKeys(skills: string[]) {
  return [...new Set(skills.map((skill) => normalizeSkill(skill)).filter(Boolean))]
}

function scoreRoleSignal(signal: RoleSkillSignal, skillKeys: string[]) {
  let score = 0
  let hits = 0
  const strong = new Set(signal.strongSkills ?? [])
  for (const key of skillKeys) {
    if (!signal.skills.includes(key)) continue
    hits += 1
    score += strong.has(key) ? 2 : 1
  }
  return { score, hits }
}

/** Infer the best role/interview-type pair from skills alone. */
export function inferRoleFromSkills(skills: string[]): {
  targetRole: NormalizedField
  interviewType: NormalizedField
} | null {
  const keys = skillSignalKeys(skills)
  if (keys.length === 0) return null

  const ranked = ROLE_SKILL_SIGNALS.map((signal) => ({
    signal,
    ...scoreRoleSignal(signal, keys),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.hits - a.hits)

  const best = ranked[0]
  if (!best || best.score < 2) return null

  const second = ranked[1]
  // Require a clear winner so ambiguous skill sets (e.g. SQL alone) do not invent a role.
  if (second && second.score >= best.score) return null

  const confidence = best.score >= 4 || (best.hits >= 2 && best.score >= 3) ? 0.94 : 0.82
  return {
    targetRole: { value: best.signal.role, confidence },
    interviewType: { value: best.signal.interviewType, confidence: Math.min(confidence, 0.88) },
  }
}

function roleSupportedBySkills(role: string, skills: string[]) {
  const keys = skillSignalKeys(skills)
  if (keys.length === 0) return false
  const signal = ROLE_SKILL_SIGNALS.find((row) => row.role.toLowerCase() === role.trim().toLowerCase())
  if (!signal) return true
  return scoreRoleSignal(signal, keys).score > 0
}

/**
 * Prefer skill-grounded role/type when the model invents a mismatched role
 * (example: SQL + Power BI → ML Engineer).
 */
export function reconcileNormalizationWithSkills(
  parsed: NormalizationAiResponse,
  input: NormalizationInput,
): NormalizationAiResponse {
  const inferred = inferRoleFromSkills(input.skills)
  if (!inferred) {
    // Drop AI roles that have zero overlap with the candidate's skills.
    if (parsed.targetRole && input.skills.length > 0 && !roleSupportedBySkills(parsed.targetRole.value, input.skills)) {
      return { ...parsed, targetRole: null }
    }
    return parsed
  }

  const aiRole = parsed.targetRole
  const aiSupported = aiRole ? roleSupportedBySkills(aiRole.value, input.skills) : false
  const shouldReplaceRole =
    !aiRole ||
    !aiSupported ||
    aiRole.value.toLowerCase() !== inferred.targetRole.value.toLowerCase()

  return {
    ...parsed,
    targetRole: shouldReplaceRole ? inferred.targetRole : aiRole,
    interviewType:
      !parsed.interviewType || shouldReplaceRole
        ? inferred.interviewType
        : parsed.interviewType,
  }
}

export function toUsableNormalization(
  parsed: NormalizationAiResponse,
  input: NormalizationInput,
): UsableNormalization {
  const reconciled = reconcileNormalizationWithSkills(parsed, input)
  const currentSkills = new Set(input.skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))
  return {
    targetRole: toUsableField(reconciled.targetRole, input.targetRole),
    candidateLevel: toUsableField(reconciled.candidateLevel, input.candidateLevel),
    interviewType: toUsableField(reconciled.interviewType, input.interviewType),
    targetCompany: toUsableField(reconciled.targetCompany, input.targetCompany),
    skills: reconciled.skills.flatMap((skill) => {
      const band = confidenceBand(skill.confidence)
      if (!band) return []
      if (currentSkills.has(skill.value.toLowerCase())) return []
      return [{ ...skill, band }]
    }),
  }
}

export function hasUsableNormalization(value: UsableNormalization) {
  return Boolean(
    value.targetRole ||
      value.candidateLevel ||
      value.interviewType ||
      value.targetCompany ||
      value.skills.length > 0,
  )
}

export function hasNormalizableInput(input: NormalizationInput) {
  return Boolean(
    input.intent.trim().length >= 12 ||
      input.targetRole.trim().length >= 3 ||
      input.interviewType.trim().length >= 3 ||
      input.targetCompany.trim().length >= 2 ||
      input.candidateLevel.trim().length >= 2 ||
      input.skills.some((skill) => skill.trim().length >= 2),
  )
}

function isExactVocabularyValue(value: string, vocabulary: readonly string[]) {
  const canonical = canonicalVocabularyValue(value, vocabulary)
  return canonical != null && canonical === value.trim()
}

export function isAlreadyCanonical(input: NormalizationInput, vocabulary: MatchingVocabulary) {
  if (input.intent.trim().length >= 12) return false
  if (input.targetRole && !isExactVocabularyValue(input.targetRole, vocabulary.roles)) return false
  if (input.candidateLevel && !isExactVocabularyValue(input.candidateLevel, vocabulary.candidateLevels)) {
    return false
  }
  if (input.interviewType && !isExactVocabularyValue(input.interviewType, vocabulary.interviewTypes)) {
    return false
  }
  if (input.targetCompany && !isExactVocabularyValue(input.targetCompany, vocabulary.companies)) return false
  if (input.skills.some((skill) => !isExactVocabularyValue(skill, vocabulary.skills))) return false
  return hasNormalizableInput(input)
}

export function buildNormalizationPatch(
  current: { skills: string[] },
  suggestions: UsableNormalization,
): NormalizationPatch {
  const patch: NormalizationPatch = {}
  if (suggestions.targetRole) patch.targetRole = suggestions.targetRole.value
  if (suggestions.candidateLevel) patch.candidateLevel = suggestions.candidateLevel.value
  if (suggestions.interviewType) patch.interviewType = suggestions.interviewType.value
  if (suggestions.targetCompany) patch.targetCompany = suggestions.targetCompany.value
  if (suggestions.skills.length > 0) {
    const skills = [...current.skills]
    for (const skill of suggestions.skills) {
      if (!skills.some((item) => item.toLowerCase() === skill.value.toLowerCase())) {
        skills.push(skill.value)
      }
    }
    patch.skills = skills
  }
  return patch
}

export function constrainNormalizedToVocabulary(
  normalized: MatchingAiNormalized | null,
  vocabulary: MatchingVocabulary,
): MatchingAiNormalized | null {
  if (!normalized) return null
  const skills = normalized.skills.flatMap((skill) => {
    const canonical = canonicalVocabularyValue(skill, vocabulary.skills)
    return canonical ? [canonical] : []
  })
  const grounded = {
    targetRole: canonicalVocabularyValue(normalized.targetRole, vocabulary.roles) ?? '',
    candidateLevel: canonicalVocabularyValue(normalized.candidateLevel, vocabulary.candidateLevels) ?? '',
    skills,
    interviewType: canonicalVocabularyValue(normalized.interviewType, vocabulary.interviewTypes) ?? '',
    domainPreference: normalized.domainPreference,
  }
  if (!grounded.targetRole && !grounded.candidateLevel && grounded.skills.length === 0 && !grounded.interviewType) {
    return null
  }
  return grounded
}

export function toNormalizationInput(values: {
  targetRole: string
  candidateLevel: string
  skills: string[]
  interviewType: string
  targetCompany: string
  intent?: string
  skillDraft?: string
}): NormalizationInput {
  const skills = [...values.skills]
  const draft = values.skillDraft?.trim() ?? ''
  if (draft && !skills.some((skill) => skill.toLowerCase() === draft.toLowerCase())) skills.push(draft)
  return {
    targetRole: values.targetRole.trim().slice(0, 80),
    candidateLevel: values.candidateLevel.trim().slice(0, 40),
    skills: skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 12),
    interviewType: values.interviewType.trim().slice(0, 60),
    targetCompany: values.targetCompany.trim().slice(0, 80),
    intent: (values.intent ?? '').trim().slice(0, 280),
  }
}
