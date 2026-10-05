import { clearCandidateLocalState } from '../account/deletion.ts'
import { supabase } from '../lib/supabase.ts'

export async function deleteMyCandidateAccount() {
  const { error } = await supabase.rpc('delete_my_candidate_account')
  if (error) throw new Error(error.message)
  clearCandidateLocalState()
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // The auth user is already removed server-side.
  }
}
