/** Normalize for identity comparisons (role / headline / company). */
function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function headlineCoversRole(headline: string, role: string): boolean {
  const h = norm(headline)
  const r = norm(role)
  if (!h || !r) return false
  if (h === r) return true
  // "software Engineer · System Design" / "software Engineer at asc"
  return h.startsWith(`${r} `) || h.startsWith(`${r}·`) || h.startsWith(`${r} ·`)
}

/**
 * One or two subtitle lines under an interviewer name.
 * Avoids repeating currentRole when headline already includes it
 * (e.g. "software Engineer · System Design" + "software Engineer @ asc").
 */
export function interviewerIdentityLines(person: {
  headline?: string | null
  currentRole?: string | null
  company?: string | null
}): string[] {
  const headline = person.headline?.trim() ?? ''
  const role = person.currentRole?.trim() ?? ''
  const company = person.company?.trim() ?? ''
  const roleAtCompany = [role, company].filter(Boolean).join(' @ ')

  if (!headline) {
    return roleAtCompany ? [roleAtCompany] : []
  }

  if (headlineCoversRole(headline, role)) {
    const lines = [headline]
    if (company && !norm(headline).includes(norm(company))) {
      lines.push(company)
    }
    return lines
  }

  if (roleAtCompany && norm(headline) === norm(roleAtCompany)) {
    return [headline]
  }

  const lines = [headline]
  if (roleAtCompany) lines.push(roleAtCompany)
  return lines
}
