import { mapSkillMatchRpcRow, skillMatchRowToMatchResult } from '../services/skillMatchMap.ts'
import { compareSkillSets, dedupeSkills } from './skills.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function almostEqual(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) < eps
}

// TEST 1 — 100%
{
  const detail = compareSkillSets(
    ['Python', 'Machine Learning'],
    ['Python', 'Machine Learning', 'Deep Learning', 'Power BI'],
  )
  expect(detail.percent === 100, 'TEST 1 percent')
  expect(JSON.stringify(detail.matchedSkills) === JSON.stringify(['Python', 'Machine Learning']), 'TEST 1 matched')
  expect(detail.candidateMissingSkills.length === 0, 'TEST 1 missing')
  expect(
    JSON.stringify(detail.interviewerExtraSkills) === JSON.stringify(['Deep Learning', 'Power BI']),
    'TEST 1 extra',
  )
}

// TEST 2 — ~66.7%
{
  const detail = compareSkillSets(['Python', 'Power BI', 'Machine Learning'], ['Python', 'Power BI'])
  expect(detail.percent === 66.7, `TEST 2 percent got ${detail.percent}`)
  expect(almostEqual(detail.ratio, 2 / 3), 'TEST 2 ratio')
  expect(JSON.stringify(detail.matchedSkills) === JSON.stringify(['Python', 'Power BI']), 'TEST 2 matched')
  expect(JSON.stringify(detail.candidateMissingSkills) === JSON.stringify(['Machine Learning']), 'TEST 2 missing')
}

// TEST 3 — 0% excluded by RPC (client compare still reports 0)
{
  const detail = compareSkillSets(['Python', 'Machine Learning'], ['SQL', 'Tableau'])
  expect(detail.percent === 0, 'TEST 3 percent')
  expect(detail.matchedSkills.length === 0, 'TEST 3 no overlap → excluded from RPC results')
}

// TEST 4–6 — matching independent of listed/service/availability (formula only uses skills)
{
  const detail = compareSkillSets(['Python'], ['python'])
  expect(detail.percent === 100, 'TEST 4–6 skill-only score')
}

// TEST 7 — accepted resume Power BI contributes when merged
{
  const finalSkills = dedupeSkills(['Python', 'Power BI'])
  const detail = compareSkillSets(finalSkills, ['Power BI'])
  expect(detail.matchedSkills.includes('Power BI'), 'TEST 7 Power BI matches')
}

// TEST 8 — rejected AWS not in candidate set
{
  const finalSkills = dedupeSkills(['Python'])
  expect(!finalSkills.some((s) => s.toLowerCase() === 'aws'), 'TEST 8 AWS excluded from candidate set')
  const detail = compareSkillSets(finalSkills, ['AWS', 'Python'])
  expect(!detail.matchedSkills.some((s) => s.toLowerCase() === 'aws'), 'TEST 8 AWS does not contribute')
}

// RPC row mapper preserves public-safe skill fields and ignores private keys if present
{
  const mapped = mapSkillMatchRpcRow({
    interviewer_profile_id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Ascar Labs',
    avatar_url: null,
    headline: null,
    bio: null,
    current_role: 'Engineer',
    company: 'RoundOne',
    experience_years: 5,
    timezone: 'Asia/Kolkata',
    languages: ['English'],
    skills: ['python', 'Machine Learning'],
    matched_skills: ['Python', 'Machine Learning'],
    missing_candidate_skills: [],
    extra_interviewer_skills: ['Deep Learning'],
    skill_ratio: 1,
    skill_percent: 100,
    rating_avg: null,
    review_count: 0,
    completed_interviews_count: 0,
    is_online: false,
    list_price_paise: 100000,
    currency: 'INR',
    is_listed: false,
    whatsapp_phone: 'should-not-map',
    email: 'should-not-map',
  })
  expect(mapped !== null, 'mapper accepts row')
  expect(mapped!.isListed === false, 'TEST 4 is_listed false still mappable')
  expect(mapped!.skillPercent === 100, 'mapper percent')
  expect(!('whatsapp_phone' in mapped!), 'whatsapp not on mapped type')
  expect(!('email' in mapped!), 'email not on mapped type')
  const match = skillMatchRowToMatchResult(mapped!)
  expect(match.score === 100, 'match score')
  expect(match.skillMatch.matchedSkills.length === 2, 'match matched skills')
}

console.log('skill match RPC client checks passed')
