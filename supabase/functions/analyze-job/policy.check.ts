import { readFileSync } from 'node:fs'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const migration = readFileSync(
  new URL('../../migrations/20260928213102_candidate_job_targets.sql', import.meta.url),
  'utf8',
)
expect(migration.includes('private.owns_candidate_profile(candidate_profile_id)'), '16 owner policy')
expect(!migration.includes('USING (true)'), '16 no permissive policy')
expect(migration.includes("RAISE EXCEPTION 'not_authenticated'"), '23 unauthorized rejected')
expect(migration.includes('REVOKE ALL ON FUNCTION public.match_interviewers_for_job'), '23 revoke public')
expect(migration.includes('FROM anon'), '23 revoke anon')
expect(!migration.includes('create_booking'), '24 booking RPC untouched')
expect(!migration.includes('match_interviewers_by_skills'), '25 existing skill match untouched')
expect(!migration.includes('assist-matching'), '26 AI interview function untouched')

console.log('policy.check passed')
