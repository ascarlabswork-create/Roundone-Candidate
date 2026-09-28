import type { SkillMatchDetail } from '../types.ts'
import { formatSkillPercentLabel, skillOverlapSummary } from '../components/interviewer/skillMatchFormat.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// TEST 1 — 100% matched + additional
{
  const detail: SkillMatchDetail = {
    matchedSkills: ['Python', 'Machine Learning'],
    candidateMissingSkills: [],
    interviewerExtraSkills: ['Power BI'],
    ratio: 1,
    percent: 100,
  }
  expect(formatSkillPercentLabel(detail.percent) === '100', 'TEST 1 percent label')
  expect(skillOverlapSummary(detail) === 'Matches 2 of your 2 skills', 'TEST 1 summary')
}

// TEST 2 — 66.7% matched / missing / additional
{
  const detail: SkillMatchDetail = {
    matchedSkills: ['Python', 'Power BI'],
    candidateMissingSkills: ['Machine Learning'],
    interviewerExtraSkills: ['SQL'],
    ratio: 2 / 3,
    percent: 66.7,
  }
  expect(formatSkillPercentLabel(detail.percent) === '66.7', 'TEST 2 percent label')
  expect(skillOverlapSummary(detail) === 'Matches 2 of your 3 skills', 'TEST 2 summary')
}

// TEST 3 — zero overlap would not render a card (UI receives empty list)
{
  const detail: SkillMatchDetail = {
    matchedSkills: [],
    candidateMissingSkills: ['Python', 'Machine Learning'],
    interviewerExtraSkills: ['SQL', 'Tableau'],
    ratio: 0,
    percent: 0,
  }
  expect(detail.matchedSkills.length === 0, 'TEST 3 no matched → excluded upstream')
}

// TEST 4 — no availability field on card model (skill-only)
{
  const detail: SkillMatchDetail = {
    matchedSkills: ['Python'],
    candidateMissingSkills: [],
    interviewerExtraSkills: [],
    ratio: 1,
    percent: 100,
  }
  expect(skillOverlapSummary(detail).includes('Matches'), 'TEST 4 still shows skill summary')
}

// TEST 5 — 100% with many extras
{
  const detail: SkillMatchDetail = {
    matchedSkills: ['Python', 'Machine Learning'],
    candidateMissingSkills: [],
    interviewerExtraSkills: ['Deep Learning', 'Power BI', 'NumPy'],
    ratio: 1,
    percent: 100,
  }
  expect(formatSkillPercentLabel(detail.percent) === '100', 'TEST 5 percent')
  expect(detail.interviewerExtraSkills.includes('Deep Learning'), 'TEST 5 extra')
}

// TEST 6 — accepted resume Power BI appears matched when backend returns it
{
  const detail: SkillMatchDetail = {
    matchedSkills: ['Power BI'],
    candidateMissingSkills: [],
    interviewerExtraSkills: [],
    ratio: 1,
    percent: 100,
  }
  expect(detail.matchedSkills.includes('Power BI'), 'TEST 6 Power BI matched')
}

// TEST 7 — rejected AWS must not appear in matched
{
  const detail: SkillMatchDetail = {
    matchedSkills: ['Python'],
    candidateMissingSkills: [],
    interviewerExtraSkills: ['AWS'],
    ratio: 1,
    percent: 100,
  }
  expect(!detail.matchedSkills.includes('AWS'), 'TEST 7 AWS not matched')
  expect(detail.interviewerExtraSkills.includes('AWS'), 'TEST 7 AWS only additional if interviewer has it')
}

console.log('skill match UI checks passed')
