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

/** Hard redirect so React auth guards cannot steal the navigation. */
export function goToAccountDeletedLogin() {
  markAccountDeleted()
  window.location.replace(ACCOUNT_DELETED_LOGIN_PATH)
}
