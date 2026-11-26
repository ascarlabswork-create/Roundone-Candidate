const STORAGE_KEY = 'jobround_account_deleted'

/** Persist across the post-delete redirect so the banner still shows if the query is dropped. */
export function markAccountDeleted() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Private mode / blocked storage — query param alone may still work.
  }
}

export function clearAccountDeleted() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function isAccountDeletedFlag(searchParam: string | null) {
  if (searchParam === '1') return true
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
