import { supabase } from '../lib/supabase.ts'

/**
 * Dual-persona: same auth user may also have an interviewer_profiles row.
 * Used to hide that persona from candidate match/browse on the client
 * (server RPCs/views also exclude profile_id = auth.uid()).
 */
export async function getOwnInterviewerProfileId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase.rpc('own_interviewer_profile_id')
  if (!error && typeof data === 'string' && data) return data
  if (!error && data == null) return null

  // Fallback if the helper RPC is not deployed yet.
  const { data: row, error: tableError } = await supabase
    .from('interviewer_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (tableError || !row || typeof row.id !== 'string') return null
  return row.id
}
