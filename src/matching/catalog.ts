import type { CandidateLevel, InterviewType } from '../data/catalogs.ts'
import { paiseToMajorUnits } from '../lib/format.ts'
import type { Interviewer, Service } from '../types.ts'
import {
  getPublicInterviewer,
  getPublicInterviewerServices,
  listPublicDirectory,
  listPublicRolesFor,
  listPublicServicesFor,
  listPublicSkillsFor,
  type PublicInterviewer,
  type PublicInterviewerRole,
  type PublicInterviewerService,
  type PublicInterviewerSkill,
} from '../services/interviewerPublic.ts'

const EMPTY_AVAILABILITY = {
  timezone: 'UTC',
  bookingBufferMin: 0,
  recurring: [],
  custom: [],
  blocked: [],
}

export type MatchingCatalogPerson = Interviewer & {
  headline: string | null
}

function emptyAvailability(timezone: string): Interviewer['availability'] {
  return { ...EMPTY_AVAILABILITY, timezone }
}

function toService(service: PublicInterviewerService): Service {
  return {
    id: service.id,
    name: service.name,
    interviewType: service.interviewType as InterviewType,
    durationMin: service.durationMin,
    price: paiseToMajorUnits(service.pricePaise),
    description: service.description ?? '',
  }
}

export function toMatchingInterviewer(
  person: PublicInterviewer,
  skills: string[],
  roles: PublicInterviewerRole[],
  services: PublicInterviewerService[],
): MatchingCatalogPerson | null {
  const mappedServices = services.map(toService)
  if (mappedServices.length === 0) return null
  const targetRoles = [...new Set(roles.map((role) => role.targetRole).filter(Boolean))]
  const candidateLevels = [...new Set(roles.map((role) => role.candidateLevel).filter(Boolean))] as CandidateLevel[]
  const interviewTypes = [...new Set(mappedServices.map((service) => service.interviewType))]
  const listPrice = person.listPricePaise != null ? paiseToMajorUnits(person.listPricePaise) : mappedServices[0].price
  const price = Math.min(listPrice, ...mappedServices.map((service) => service.price))

  return {
    id: person.id,
    name: person.name,
    photo: person.photo ?? '',
    currentRole: person.currentRole ?? person.headline ?? 'Interviewer',
    company: person.company ?? '',
    experienceYears: person.experienceYears,
    skills,
    technologies: [],
    interviewTypes,
    candidateLevels,
    targetRoles,
    rating: person.ratingAvg ?? 0,
    reviewCount: person.reviewCount,
    completedInterviews: person.completedInterviews,
    price,
    currency: 'INR',
    services: mappedServices,
    availability: emptyAvailability(person.timezone),
    isOnline: person.isOnline,
    verification: {
      identity: person.identityVerified,
      employment: person.employmentVerified,
      linkedin: person.linkedinVerified,
    },
    bio: person.bio ?? person.headline ?? '',
    previousCompanies: [],
    languages: person.languages,
    timezone: person.timezone,
    headline: person.headline,
  }
}

export async function loadMatchingCatalog(): Promise<MatchingCatalogPerson[]> {
  const directory = await listPublicDirectory()
  const ids = directory.map((person) => person.id)
  const [skills, roles, services] = await Promise.all([
    listPublicSkillsFor(ids),
    listPublicRolesFor(ids),
    listPublicServicesFor(ids),
  ])

  const skillsById = groupSkills(skills)
  const rolesById = groupRoles(roles)
  const servicesById = groupServices(services)

  return directory.flatMap((person) => {
    const mapped = toMatchingInterviewer(
      person,
      skillsById.get(person.id) ?? [],
      rolesById.get(person.id) ?? [],
      servicesById.get(person.id) ?? [],
    )
    return mapped ? [mapped] : []
  })
}

export async function loadMatchingInterviewer(id: string): Promise<MatchingCatalogPerson | null> {
  const [person, skills, roles, services] = await Promise.all([
    getPublicInterviewer(id),
    listPublicSkillsFor([id]),
    listPublicRolesFor([id]),
    getPublicInterviewerServices(id),
  ])
  if (!person) return null
  return toMatchingInterviewer(
    person,
    skills.map((row) => row.skill),
    roles,
    services,
  )
}

function groupSkills(rows: PublicInterviewerSkill[]) {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const current = map.get(row.interviewerProfileId) ?? []
    if (!current.includes(row.skill)) current.push(row.skill)
    map.set(row.interviewerProfileId, current)
  }
  return map
}

function groupRoles(rows: PublicInterviewerRole[]) {
  const map = new Map<string, PublicInterviewerRole[]>()
  for (const row of rows) {
    const current = map.get(row.interviewerProfileId) ?? []
    current.push(row)
    map.set(row.interviewerProfileId, current)
  }
  return map
}

function groupServices(rows: PublicInterviewerService[]) {
  const map = new Map<string, PublicInterviewerService[]>()
  for (const row of rows) {
    const current = map.get(row.interviewerProfileId) ?? []
    current.push(row)
    map.set(row.interviewerProfileId, current)
  }
  return map
}
