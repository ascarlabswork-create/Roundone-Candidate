import {
  allowedFactorPool,
  combineMatchScore,
  mergeNormalizedPreferences,
  parseMatchingAiResponse,
} from './aiModel.ts'
import type { MatchingPreferences } from '../types.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function runMatchingAiChecks() {
  const prefs: MatchingPreferences = {
    targetRole: 'Backend Engineer',
    candidateLevel: 'SDE 2',
    interviewType: 'Coding',
    targetCompany: '',
    skills: ['Python'],
    preferredDate: '',
    preferredTime: '',
    budget: 0,
    language: '',
    naturalLanguageQuery: 'I want a backend interview for Python and FastAPI, preferably someone who has worked with startups.',
  }

  const allowed = new Set(['svc-1'])
  const pool = allowedFactorPool(
    {
      targetRole: prefs.targetRole,
      candidateLevel: prefs.candidateLevel,
      skills: ['Python', 'FastAPI'],
      interviewType: prefs.interviewType,
      targetCompany: '',
      language: '',
      budget: 0,
      intent: prefs.naturalLanguageQuery ?? '',
    },
    [
      {
        interviewerId: 'int-1',
        name: 'Ada',
        currentRole: 'Backend Engineer',
        company: 'Stripe',
        headline: 'Python services',
        skills: ['Python', 'FastAPI'],
        targetRoles: ['Backend Engineer'],
        candidateLevels: ['SDE 2'],
        languages: ['English'],
        ratingAvg: 4.8,
        reviewCount: 12,
        completedInterviews: 40,
        services: [
          {
            id: 'svc-1',
            name: 'Technical Mock Interview',
            interviewType: 'Coding',
            durationMin: 60,
            pricePaise: 150000,
            description: 'Backend coding mock',
          },
        ],
      },
    ],
  )

  const parsed = parseMatchingAiResponse(
    {
      normalized: {
        target_role: 'Backend Engineer',
        skills: ['Python', 'FastAPI'],
        interview_type: 'Technical Mock Interview',
        domain_preference: 'Startup experience',
      },
      matches: [
        {
          service_id: 'svc-1',
          relevance_score: 0.87,
          matched_factors: ['Python', 'FastAPI', 'Made up award'],
          explanation: 'Matches your Python and FastAPI preferences and offers a technical mock interview.',
        },
        {
          service_id: 'unknown',
          relevance_score: 0.9,
          matched_factors: ['Python'],
          explanation: 'Invented interviewer',
        },
      ],
    },
    allowed,
    pool,
  )
  expect(parsed != null, 'Valid payload parses')
  expect(parsed!.matches.length === 1, 'Unknown service ids are dropped')
  expect(parsed!.matches[0].matchedFactors.includes('Python'), 'Grounded factor is kept')
  expect(!parsed!.matches[0].matchedFactors.includes('Made up award'), 'Ungrounded factor is dropped')
  expect(parsed!.normalized?.skills.includes('FastAPI') === true, 'Normalized skills are kept')

  const rejected = parseMatchingAiResponse(
    {
      matches: [
        {
          service_id: 'svc-1',
          relevance_score: 0.9,
          matched_factors: ['Python'],
          explanation: 'Guaranteed to help you get hired.',
        },
      ],
    },
    allowed,
    pool,
  )
  expect(rejected?.matches.length === 0, 'Banned hiring claims are rejected')

  const malformed = parseMatchingAiResponse({ matches: 'nope' }, allowed, pool)
  expect(malformed?.matches.length === 0, 'Malformed matches become an empty list')

  const merged = mergeNormalizedPreferences(prefs, parsed!.normalized)
  expect(merged.skills.includes('FastAPI'), 'Normalized skills merge into empty gaps without dropping existing skills')
  expect(merged.targetRole === 'Backend Engineer', 'Existing structured role is preserved')

  expect(combineMatchScore(80, 1) === Math.round(80 * 0.85 + 15), 'Deterministic score remains the dominant factor')
  expect(combineMatchScore(80, null) === 80, 'Missing AI relevance keeps the deterministic score')

  return true
}

runMatchingAiChecks()
console.log('matching AI checks passed')
