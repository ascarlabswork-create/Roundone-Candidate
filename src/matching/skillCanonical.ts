/**
 * Deterministic skill canonicalization for RoundOne matching.
 * Approved aliases only — no fuzzy match, no runtime LLM.
 *
 * Explicit mapping:
 * "Machine Learning Algorithms" → canonical "Machine Learning".
 * This is a resume/profile wording variant, not a general parent/child rule.
 * Deep Learning is NOT Machine Learning. PyTorch is NOT Python. Tableau is NOT Power BI.
 */

export type CanonicalSkill = {
  /** Stable comparison key. */
  key: string
  /** Human-readable label used in match results. */
  display: string
}

type CanonicalDefinition = {
  key: string
  display: string
  /** Lookup keys after punctuation normalization. */
  aliases: string[]
}

const CANONICAL_SKILLS: CanonicalDefinition[] = [
  {
    key: 'python',
    display: 'Python',
    aliases: ['python', 'python 3', 'python3'],
  },
  {
    key: 'machine learning',
    display: 'Machine Learning',
    aliases: ['ml', 'machine learning', 'machine learning algorithms'],
  },
  {
    key: 'power bi',
    display: 'Power BI',
    aliases: ['power bi', 'powerbi'],
  },
  {
    key: 'pandas',
    display: 'Pandas',
    aliases: ['pandas'],
  },
  {
    key: 'numpy',
    display: 'NumPy',
    aliases: ['numpy'],
  },
  {
    key: 'scikit-learn',
    display: 'Scikit-learn',
    aliases: ['scikit learn', 'scikitlearn', 'sklearn'],
  },
  {
    key: 'jupyter notebook',
    display: 'Jupyter Notebook',
    aliases: ['jupyter', 'jupyter notebook'],
  },
  {
    key: 'streamlit',
    display: 'Streamlit',
    aliases: ['streamlit'],
  },
]

/** Approved alias phrases, longest first. Recognition only — labels still come from canonicalizeSkill. */
export function canonicalSkillAliases(): string[] {
  const aliases = CANONICAL_SKILLS.flatMap((skill) => skill.aliases)
  return [...new Set(aliases)].sort((a, b) => b.length - a.length)
}

const ALIAS_TO_CANONICAL = new Map<string, CanonicalSkill>()
for (const skill of CANONICAL_SKILLS) {
  const canonical = { key: skill.key, display: skill.display }
  ALIAS_TO_CANONICAL.set(skill.key, canonical)
  for (const alias of skill.aliases) {
    ALIAS_TO_CANONICAL.set(alias, canonical)
  }
}

/** Trim, lowercase, hyphens/underscores to spaces, drop periods, collapse whitespace. */
export function skillLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanedDisplay(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Canonical key + display. Empty input returns null. Unknown skills keep their own key. */
export function canonicalizeSkill(value: string): CanonicalSkill | null {
  const display = cleanedDisplay(value)
  if (!display) return null
  const lookup = skillLookupKey(display)
  if (!lookup) return null
  const known = ALIAS_TO_CANONICAL.get(lookup)
  if (known) return known
  return { key: lookup, display }
}

/** Comparison key. Empty input returns ''. */
export function normalizeSkill(value: string): string {
  return canonicalizeSkill(value)?.key ?? ''
}

/** Human-readable label for matching output. */
export function skillDisplayName(value: string): string {
  return canonicalizeSkill(value)?.display ?? ''
}

export function skillsMatch(left: string, right: string): boolean {
  const a = normalizeSkill(left)
  const b = normalizeSkill(right)
  return a !== '' && a === b
}
