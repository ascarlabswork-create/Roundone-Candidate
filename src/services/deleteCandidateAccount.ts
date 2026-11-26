import { clearCandidateLocalState } from '../account/deletion.ts'
import { markAccountDeleted } from '../lib/accountDeletedBanner.ts'
import { supabase } from '../lib/supabase.ts'

export const ACCOUNT_DELETED_LOGIN_PATH = '/candidate/login?deleted=1'

/**
 * Deletes candidate data. Does not sign out here — callers must hard-redirect
 * to the login URL first so RequireCandidateAuth cannot race to `/?auth=login`
 * and drop the deleted banner.
 */
export async function deleteMyCandidateAccount() {
  const { error } = await supabase.rpc('delete_my_candidate_account')
  if (error) throw new Error(error.message)
  clearCandidateLocalState()
  markAccountDeleted()
}

/** Clear the dead JWT, then hard-redirect so the deleted confirmation dialog can show. */
export async function goToAccountDeletedLogin() {
  markAccountDeleted()
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Auth user may already be removed.
  }
  window.location.replace(ACCOUNT_DELETED_LOGIN_PATH)
}
