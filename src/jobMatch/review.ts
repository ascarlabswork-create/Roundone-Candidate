import { dedupeSkills } from '../matching/skills.ts'

/** User edits win. A later analysis must not overwrite them. */
export function preserveReviewedSkills(edited: string[] | null, extracted: string[]) {
  if (edited) return dedupeSkills(edited)
  return dedupeSkills(extracted)
}
