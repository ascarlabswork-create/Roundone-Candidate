import type { Interviewer, MatchingPreferences } from '../types.ts'
import { rankInterviewers, scoreInterviewer } from './score.ts'
import { compareSkillSets, dedupeSkills, isCanonicalSkillDuplicate, normalizeSkill, uniqueCandidateSkillWording } from './skills.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function almostEqual(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) < eps
}

function emptyPrefs(skills: string[]): MatchingPreferences {
  return {
    targetRole: '',
    candidateLevel: '',
    interviewType: '',
    targetCompany: '',
    skills,
    preferredDate: '',
    preferredDateEnd: '',
    preferredTime: '',
    budget: 0,
    language: '',
  }
}

function fakeInterviewer(id: string, skills: string[], serviceName = 'Data analyst'): Interviewer {
  return {
    id,
    name: id,
    photo: '',
    currentRole: 'Interviewer',
    company: '',
    experienceYears: 1,
    skills,
    technologies: [],
    interviewTypes: [],
    candidateLevels: [],
    targetRoles: [],
    rating: 0,
    reviewCount: 0,
    completedInterviews: 0,
    price: 1000,
    currency: 'INR',
    services: [
      {
        id: `${id}-svc`,
        name: serviceName,
        interviewType: 'Technical' as Interviewer['interviewTypes'][number],
        durationMin: 60,
        price: 1000,
        description: '',
      },
    ],
    availability: {
      timezone: 'Asia/Kolkata',
      bookingBufferMin: 0,
      recurring: [],
      custom: [],
      blocked: [],
    },
    isOnline: false,
    verification: { identity: false, employment: false, linkedin: false },
    bio: '',
    previousCompanies: [],
    languages: [],
    timezone: 'Asia/Kolkata',
  }
}

expect(normalizeSkill(' PYTHON ') === 'python', 'trim + lowercase')
expect(
  JSON.stringify(dedupeSkills(['Python', 'python', ' PYTHON ', 'Machine Learning'])) ===
    JSON.stringify(['Python', 'Machine Learning']),
  'dedupe keeps first casing',
)

// TEST 1 — 100% match
{
  const match = scoreInterviewer(
    fakeInterviewer('a', ['Python', 'Machine Learning']),
    emptyPrefs(['Python', 'Machine Learning']),
  )
  expect(match.score === 100, 'TEST 1 score')
  expect(match.skillMatch.percent === 100, 'TEST 1 percent')
  expect(match.skillMatch.matchedSkills.length === 2, 'TEST 1 matched')
  expect(match.skillMatch.candidateMissingSkills.length === 0, 'TEST 1 no missing')
}

// TEST 2 — 66.7% green / red / neutral
{
  const detail = compareSkillSets(
    ['Python', 'Power BI', 'Machine Learning'],
    ['Python', 'Power BI', 'SQL'],
  )
  expect(detail.percent === 66.7, `TEST 2 percent got ${detail.percent}`)
  expect(almostEqual(detail.ratio, 2 / 3), 'TEST 2 ratio')
  expect(JSON.stringify(detail.matchedSkills) === JSON.stringify(['Python', 'Power BI']), 'TEST 2 green')
  expect(JSON.stringify(detail.candidateMissingSkills) === JSON.stringify(['Machine Learning']), 'TEST 2 red')
  expect(JSON.stringify(detail.interviewerExtraSkills) === JSON.stringify(['SQL']), 'TEST 2 neutral')
}

// TEST 3 — 0% ranks below matching interviewers
{
  const ranked = rankInterviewers(
    [
      fakeInterviewer('zero', ['SQL', 'Tableau']),
      fakeInterviewer('full', ['Python', 'Machine Learning']),
    ],
    emptyPrefs(['Python', 'Machine Learning']),
  )
  expect(ranked[0].interviewerId === 'full', 'TEST 3 matching ranks first')
  expect(ranked[1].interviewerId === 'zero', 'TEST 3 zero ranks below')
  expect(ranked[1].score === 0, 'TEST 3 zero score')
}

// TEST 4 — skill score ignores availability
{
  const match = scoreInterviewer(
    fakeInterviewer('avail', ['python', 'Machine Learning']),
    emptyPrefs(['Python', 'Machine Learning']),
  )
  expect(match.score === 100, 'TEST 4 appears without availability factor')
}

// TEST 5 — service name unused
{
  const match = scoreInterviewer(
    fakeInterviewer('svc', ['Python', 'Machine Learning'], 'Data analyst'),
    emptyPrefs(['Python', 'Machine Learning']),
  )
  expect(match.score === 100, 'TEST 5 service name unused')
  expect(!match.skillMatch.matchedSkills.includes('Data analyst'), 'TEST 5 service not a skill')
}

// TEST 6 — accepted resume skill contributes when merged
{
  const finalSkills = dedupeSkills(['Python', 'Power BI', 'Machine Learning'])
  expect(
    JSON.stringify(finalSkills) === JSON.stringify(['Python', 'Power BI', 'Machine Learning']),
    'TEST 6 final skills',
  )
  const detail = compareSkillSets(finalSkills, ['Power BI'])
  expect(detail.matchedSkills.includes('Power BI'), 'TEST 6 Power BI matches')
  expect(detail.percent === 33.3, `TEST 6 one of three → 33.3 got ${detail.percent}`)
}

// TEST 7 — rejected/unreviewed AWS excluded
{
  const finalSkills = dedupeSkills(['Python', 'Power BI'])
  expect(!finalSkills.some((s) => s.toLowerCase() === 'aws'), 'TEST 7 AWS excluded')
  const detail = compareSkillSets(finalSkills, ['AWS', 'Python'])
  expect(detail.matchedSkills.includes('Python'), 'TEST 7 Python matches')
  expect(!detail.matchedSkills.some((s) => s.toLowerCase() === 'aws'), 'TEST 7 AWS not matched')
}

{
  const detail = compareSkillSets([], ['Python'])
  expect(detail.percent === null, 'empty candidate → percent null')
  expect(detail.ratio === 0, 'empty candidate → ratio 0')
}

// TEST 8 — no service does not change the skill score
{
  const prefs = emptyPrefs(['Python', 'ML'])
  const withService = scoreInterviewer(fakeInterviewer('with-service', ['Python', 'Machine Learning']), prefs)
  const withoutService = scoreInterviewer(
    { ...fakeInterviewer('no-service', ['Python', 'Machine Learning']), services: [] },
    prefs,
  )
  expect(withService.score === 100, 'TEST 8 service interviewer scores 100')
  expect(withoutService.score === withService.score, 'TEST 8 missing service does not change score')
  expect(withoutService.skillMatch.matchedSkills.length === 2, 'TEST 8 both skills match without a service')
}

// TEST 9 — stored wording is kept; canonical duplicates collapse
{
  const stored = uniqueCandidateSkillWording(['Python', 'python', 'Python 3'])
  expect(JSON.stringify(stored) === JSON.stringify(['Python']), 'TEST 9 python aliases collapse to the first wording')
  const power = uniqueCandidateSkillWording(['Power BI', 'PowerBI'])
  expect(JSON.stringify(power) === JSON.stringify(['Power BI']), 'TEST 9 PowerBI is the same skill')
  expect(isCanonicalSkillDuplicate(['Machine Learning'], 'ML'), 'TEST 9 ML duplicates Machine Learning')
  expect(!isCanonicalSkillDuplicate(['Machine Learning'], 'ML', 'Machine Learning'), 'TEST 9 editing the same row is allowed')
}

console.log('skill matching checks passed')
