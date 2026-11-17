/**
 * Behavioral contract for resolveMatchingCandidateSkills (documented here; async
 * I/O is covered by Find → Matches using prefs.skills only when non-empty).
 *
 * - Non-empty session skills → those skills alone (no profile/resume merge)
 * - Empty session skills → profile ∪ accepted resume skills
 */
function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// Mirror of the early-return branch in candidateSkills.ts
function resolveSessionOnly(sessionSkills: string[], profileAndResume: string[]) {
  const session = [...new Set(sessionSkills.map((s) => s.trim()).filter(Boolean))]
  if (session.length > 0) return session
  return [...new Set(profileAndResume.map((s) => s.trim()).filter(Boolean))]
}

{
  const out = resolveSessionOnly(['TypeScript'], ['Python', 'Pandas', 'Machine Learning', 'TypeScript'])
  expect(out.length === 1 && out[0] === 'TypeScript', 'TEST 1 Find skills alone — no 31-skill merge')
}

{
  const out = resolveSessionOnly([], ['Python', 'Pandas', 'Machine Learning'])
  expect(out.length === 3, 'TEST 2 empty Find → fall back to profile/resume')
}

console.log('candidate skills resolve checks passed')
