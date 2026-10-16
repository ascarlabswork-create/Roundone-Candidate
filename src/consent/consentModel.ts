export const COOKIE_CONSENT_VERSION = 1
export const COOKIE_CONSENT_STORAGE_KEY = 'roundone-cookie-consent'

export type CookieCategoryId = 'essential' | 'analytics' | 'marketing'

export type CookieConsentRecord = {
  version: number
  essential: true
  analytics: boolean
  marketing: boolean
  updatedAt: string
}

export type CookieCategoryMeta = {
  id: CookieCategoryId
  title: string
  description: string
  required: boolean
  /** Optional integrations are not wired in this app unless marked available. */
  available: boolean
}

export const COOKIE_CATEGORIES: CookieCategoryMeta[] = [
  {
    id: 'essential',
    title: 'Essential',
    description:
      'Required for sign-in, security, and core features such as bookings and live interviews. These cannot be turned off.',
    required: true,
    available: true,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description:
      'Would help us understand how the product is used. No analytics provider is connected in this candidate app today.',
    required: false,
    available: false,
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description:
      'Would support advertising or remarketing. No marketing or ad trackers are connected in this candidate app today.',
    required: false,
    available: false,
  },
]

export function defaultOptionalDenied(): Pick<CookieConsentRecord, 'analytics' | 'marketing'> {
  return { analytics: false, marketing: false }
}

export function buildConsentRecord(choice: {
  analytics: boolean
  marketing: boolean
  now?: Date
}): CookieConsentRecord {
  const meta = COOKIE_CATEGORIES
  const analytics = meta.find((c) => c.id === 'analytics')?.available ? choice.analytics : false
  const marketing = meta.find((c) => c.id === 'marketing')?.available ? choice.marketing : false
  return {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics,
    marketing,
    updatedAt: (choice.now ?? new Date()).toISOString(),
  }
}

export function acceptAllConsent(now?: Date): CookieConsentRecord {
  return buildConsentRecord({ analytics: true, marketing: true, now })
}

export function rejectOptionalConsent(now?: Date): CookieConsentRecord {
  return buildConsentRecord({ ...defaultOptionalDenied(), now })
}

export function parseConsentRecord(value: unknown): CookieConsentRecord | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.version !== COOKIE_CONSENT_VERSION) return null
  if (row.essential !== true) return null
  if (typeof row.analytics !== 'boolean' || typeof row.marketing !== 'boolean') return null
  if (typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt))) return null
  return {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics: row.analytics,
    marketing: row.marketing,
    updatedAt: row.updatedAt,
  }
}

export function hasValidConsent(record: CookieConsentRecord | null): record is CookieConsentRecord {
  return record != null && record.version === COOKIE_CONSENT_VERSION
}
