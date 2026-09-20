import type { Interviewer, InterviewerFilters } from '../types.ts'

function matchesExperience(years: number, bucket: string) {
  if (bucket === '0-2') return years <= 2
  if (bucket === '3-5') return years >= 3 && years <= 5
  if (bucket === '6-9') return years >= 6 && years <= 9
  if (bucket === '10+') return years >= 10
  return true
}

function matchesPrice(price: number, bucket: string) {
  if (bucket === 'under-2000') return price < 2000
  if (bucket === '2000-4000') return price >= 2000 && price <= 4000
  if (bucket === '4000-6000') return price >= 4000 && price <= 6000
  if (bucket === '6000+') return price >= 6000
  return true
}

/** Client-side browse filters over the live public matching catalog. */
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
    if (filters?.skills?.length) {
      const pool = [...person.skills, ...person.technologies]
      if (!filters.skills.some((skill) => pool.includes(skill))) return false
    }
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
