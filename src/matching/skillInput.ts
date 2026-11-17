/** Split typed skill drafts on commas, semicolons, or newlines. */
export function parseSkillDraft(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}

/**
 * When the draft contains separators, return complete skills to add and the
 * leftover incomplete token still being typed (e.g. "Python, SQL, Re" →
 * complete ["Python","SQL"], remainder "Re").
 */
export function splitSkillDraftForCommit(raw: string): { complete: string[]; remainder: string } {
  if (!/[,;\n]/.test(raw)) {
    return { complete: [], remainder: raw }
  }
  const endsWithSeparator = /[,;\n]\s*$/.test(raw)
  const parts = parseSkillDraft(raw)
  if (endsWithSeparator) {
    return { complete: parts, remainder: '' }
  }
  return {
    complete: parts.slice(0, -1),
    remainder: parts[parts.length - 1] ?? '',
  }
}
