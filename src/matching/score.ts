import { isVerified } from '../data/interviewers.ts'
import type { Interviewer, MatchBreakdown, MatchingPreferences, MatchResult } from '../types.ts'
import { compareSkillSets } from './skills.ts'

const EMPTY_BREAKDOWN: MatchBreakdown = {
  targetRole: 0,
  interviewType: 0,
  skills: 0,
  candidateLevel: 0,
  availability: 0,
  company: 0,
  price: 0,
  quality: 0,
  language: 0,
}

/**
 * Skill-only interviewer score (Step 1).
 * Uses interviewer.skills only — not services, role, availability, price, etc.
 */
export function scoreInterviewer(interviewer: Interviewer, prefs: MatchingPreferences): MatchResult {
  // Interviewer stored skills only (never service names / technologies).
  const skillMatch = compareSkillSets(prefs.skills, interviewer.skills)
  const breakdown: MatchBreakdown = {
    ...EMPTY_BREAKDOWN,
    skills: skillMatch.ratio,
  }

  return {
    interviewerId: interviewer.id,
    // Integer percent for MatchScore badge; detail.percent keeps one decimal for labels.
    score: skillMatch.percent == null ? 0 : Math.round(skillMatch.percent),
    breakdown,
    reasons: [
      {
        key: 'skills',
        label: 'Skill overlap',
        matched: skillMatch.matchedSkills.length > 0,
      },
    ],
    skillMatch,
  }
}

export function rankInterviewers(interviewers: Interviewer[], prefs: MatchingPreferences) {
  return interviewers
    .map((person) => scoreInterviewer(person, prefs))
    .sort((a, b) => {
      if (b.skillMatch.ratio !== a.skillMatch.ratio) return b.skillMatch.ratio - a.skillMatch.ratio
      return b.skillMatch.matchedSkills.length - a.skillMatch.matchedSkills.length
    })
}

export function hasMeaningfulPreferences(prefs: MatchingPreferences | null) {
  if (!prefs) return false
  return Boolean(
    prefs.targetRole ||
      prefs.candidateLevel ||
      prefs.interviewType ||
      prefs.targetCompany ||
      prefs.skills.length ||
      prefs.preferredDate ||
      prefs.budget ||
      Boolean(prefs.naturalLanguageQuery?.trim()),
  )
}

/** Find → Matches needs a non-empty skill set for skill-only ranking. */
export function hasMatchingSkills(prefs: MatchingPreferences | null) {
  return Boolean(prefs?.skills.some((skill) => skill.trim()))
}

export { isVerified }
