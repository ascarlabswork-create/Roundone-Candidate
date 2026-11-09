import type { Interviewer, InterviewerFilters } from '../types.ts'
import { compareSkillSets } from './skills.ts'

function matchesExperience(years: number, bucket: string) {
  if (bucket === '0-2' || bucket === '0-3') return years <= 3
  if (bucket === '3-5' || bucket === '3-6') return years >= 3 && years <= 6
  if (bucket === '6-9' || bucket === '6-10') return years >= 6 && years <= 10
  if (bucket === '10+') return years >= 10
  return true
}

function matchesPrice(price: number, bucket: string) {
  if (bucket === 'under-1000' || bucket === 'under-2000') return price < (bucket === 'under-1000' ? 1000 : 2000)
  if (bucket === '1000-1500') return price >= 1000 && price <= 1500
  if (bucket === '1500-2000') return price >= 1500 && price <= 2000
  if (bucket === '2000-4000') return price >= 2000 && price <= 4000
  if (bucket === '2000+') return price >= 2000
  if (bucket === '4000-6000') return price >= 4000 && price <= 6000
  if (bucket === '6000+') return price >= 6000
  return true
}

/** True when the interviewer shares at least one canonical skill with the candidate. */
export function hasSkillOverlap(candidateSkills: string[], interviewer: Interviewer) {
  if (candidateSkills.length === 0) return false
  return compareSkillSets(candidateSkills, interviewer.skills).matchedSkills.length > 0
}

/**
 * Client-side browse filters over the live public matching catalog.
 * Skill filters use canonical overlap (same rules as Find → Matches), not exact string equality.
 */
export function filterPublicInterviewers(people: Interviewer[], filters?: Partial<InterviewerFilters>) {
  const query = filters?.query?.trim().toLowerCase() ?? ''
  return people.filter((person) => {
    const haystack = [
      person.name,
      person.currentRole,
      person.company,
      ...person.skills,
      ...person.technologies,
      ...person.interviewTypes,
      ...person.previousCompanies,
    ]
      .join(' ')
      .toLowerCase()

    if (query && !haystack.includes(query)) return false
    if (filters?.onlineOnly && !person.isOnline) return false
    if (filters?.verifiedOnly && !(person.verification.identity && person.verification.employment)) return false
    if (filters?.interviewTypes?.length && !filters.interviewTypes.some((type) => person.interviewTypes.includes(type as never))) {
      return false
    }
    if (filters?.candidateLevels?.length && !filters.candidateLevels.some((level) => person.candidateLevels.includes(level as never))) {
      return false
    }
    if (filters?.targetRoles?.length && !filters.targetRoles.some((role) => person.targetRoles.includes(role))) {
      return false
    }
    if (filters?.companies?.length && !filters.companies.includes(person.company)) return false
    if (filters?.skills?.length && !hasSkillOverlap(filters.skills, person)) return false
    if (filters?.languages?.length && !filters.languages.some((language) => person.languages.includes(language))) {
      return false
    }
    if (filters?.experience && !matchesExperience(person.experienceYears, filters.experience)) return false
    if (filters?.price && !matchesPrice(person.price, filters.price)) return false
    if (filters?.rating && person.rating < Number(filters.rating)) return false
    // Availability browse filter is applied via live bookable slots on Find/Matches; skip mock calendar here.
    return true
  })
}

/**
 * Browse must never dump the full directory. Candidates only see interviewers
 * who share skills with their Find/profile skill set, then other filters apply.
 */
export function filterInterviewersForCandidateBrowse(
  people: Interviewer[],
  candidateSkills: string[],
  filters?: Partial<InterviewerFilters>,
) {
  if (candidateSkills.length === 0) return []
  const relevant = people.filter((person) => hasSkillOverlap(candidateSkills, person))
  return filterPublicInterviewers(relevant, {
    ...filters,
    // Candidate skill gate already applied; panel skill checkboxes further narrow.
    skills: filters?.skills?.length ? filters.skills : [],
  })
}
