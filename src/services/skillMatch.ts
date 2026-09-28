import { supabase } from '../lib/supabase.ts'
import {
  mapSkillMatchRpcRow,
  skillMatchRowToCatalogPerson,
  skillMatchRowToMatchResult,
  type SkillMatchRpcRow,
} from './skillMatchMap.ts'

export const MATCH_INTERVIEWERS_BY_SKILLS_RPC = 'match_interviewers_by_skills'

export type { SkillMatchRpcRow }
export { mapSkillMatchRpcRow, skillMatchRowToCatalogPerson, skillMatchRowToMatchResult }

/**
 * Candidate-authenticated skill-only match RPC.
 * Does not require is_listed; excludes zero-overlap interviewers server-side.
 */
export async function matchInterviewersBySkills(candidateSkills: string[]): Promise<SkillMatchRpcRow[]> {
  const { data, error } = await supabase.rpc(MATCH_INTERVIEWERS_BY_SKILLS_RPC, {
    p_candidate_skills: candidateSkills,
  })
  if (error) throw new Error(error.message || 'Unable to match interviewers.')
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const mapped = mapSkillMatchRpcRow(row)
    return mapped ? [mapped] : []
  })
}
