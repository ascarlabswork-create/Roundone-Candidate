import {
  COOKIE_CONSENT_STORAGE_KEY,
  parseConsentRecord,
  type CookieConsentRecord,
} from './consentModel.ts'

export function readStoredConsent(): CookieConsentRecord | null {
  try {
    const item = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!item) return null
    return parseConsentRecord(JSON.parse(item))
  } catch {
    return null
  }
}

export function writeStoredConsent(record: CookieConsentRecord): boolean {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

/** Test helper: isolated storage map. Does not touch Supabase auth keys. */
export function createConsentStorageAdapter(store: Map<string, string>) {
  return {
    read(): CookieConsentRecord | null {
      const raw = store.get(COOKIE_CONSENT_STORAGE_KEY)
      if (!raw) return null
      try {
        return parseConsentRecord(JSON.parse(raw))
      } catch {
        return null
      }
    },
    write(record: CookieConsentRecord): boolean {
      try {
        store.set(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record))
        return true
      } catch {
        return false
      }
    },
  }
}
