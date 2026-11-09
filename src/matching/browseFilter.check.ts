import { filterInterviewersForCandidateBrowse, hasSkillOverlap } from './browseFilter.ts'
import type { Interviewer } from '../types.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function fakePerson(id: string, skills: string[], company = 'Acme'): Interviewer {
  return {
    id,
    name: id,
    photo: '',
    currentRole: 'Engineer',
    company,
    experienceYears: 5,
    skills,
    technologies: [],
    interviewTypes: [],
    candidateLevels: [],
    targetRoles: [],
    rating: 4,
    reviewCount: 1,
    completedInterviews: 1,
    price: 0,
    currency: 'INR',
    languages: ['English'],
    previousCompanies: [],
    bio: '',
    timezone: 'UTC',
    isOnline: false,
    verification: { identity: true, employment: true },
    services: [],
    availability: { timezone: 'UTC', bookingBufferMin: 0, recurring: [], custom: [], blocked: [] },
  }
}

const python = fakePerson('py', ['Python', 'Django'])
const react = fakePerson('fe', ['React', 'TypeScript'])
const pending = fakePerson('none', ['Abap'])

expect(hasSkillOverlap(['Python'], python), 'Python overlaps Django engineer')
expect(!hasSkillOverlap(['Python'], react), 'Python does not overlap React engineer')
expect(!hasSkillOverlap([], python), 'Empty candidate skills never overlap')

const browsed = filterInterviewersForCandidateBrowse([python, react, pending], ['python', 'FastAPI'])
expect(browsed.length === 1 && browsed[0]?.id === 'py', 'Browse hides zero-overlap interviewers')

const empty = filterInterviewersForCandidateBrowse([python, react, pending], [])
expect(empty.length === 0, 'Browse with no skills returns nobody')

console.log('browseFilter checks passed')
