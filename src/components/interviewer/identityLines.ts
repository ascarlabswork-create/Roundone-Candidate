/** Normalize for identity comparisons (role / headline). */
function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function headlineLead(headline: string): string {
  const h = norm(headline)
  return (h.split(/\s*[·•|/\\,@]\s*|\s+[–—-]\s+/)[0] ?? h).trim()
}

function headlineCoversRole(headline: string, role: string): boolean {
  const h = norm(headline)
  const r = norm(role)
  if (!h || !r) return false
  if (h === r || headlineLead(headline) === r) return true
  // "software Engineer · System Design" / "software Engineer at asc"
  return h.startsWith(`${r} `) || h.startsWith(`${r}·`) || h.startsWith(`${r} ·`)
}

/**
 * One or two subtitle lines under an interviewer name.
 * Company is never shown to candidates (kept off booking and match cards).
 */
export function interviewerIdentityLines(person: {
  headline?: string | null
  currentRole?: string | null
  company?: string | null
}): string[] {
  const headline = person.headline?.trim() ?? ''
  const role = person.currentRole?.trim() ?? ''
  void person.company

  if (!headline) {
    return role ? [role] : []
  }

  if (headlineCoversRole(headline, role)) {
    return [headline]
  }

  if (role && norm(headline) === norm(role)) {
    return [headline]
  }

  const lines = [headline]
  if (role) lines.push(role)
  return lines
}
