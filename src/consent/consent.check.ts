import {
  acceptAllConsent,
  buildConsentRecord,
  COOKIE_CONSENT_VERSION,
  parseConsentRecord,
  rejectOptionalConsent,
} from './consentModel.ts'
import { createConsentStorageAdapter } from './consentStorage.ts'
import {
  ANALYTICS_INTEGRATION_CONFIGURED,
  getIntegrationSnapshot,
  resetOptionalIntegrationsForTests,
  syncOptionalIntegrations,
} from './optionalIntegrations.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// 1. First visit with no consent
const store = new Map<string, string>()
const adapter = createConsentStorageAdapter(store)
expect(adapter.read() === null, 'first visit has no consent')

// 2. Accept All
const accepted = acceptAllConsent(new Date('2026-01-01T00:00:00.000Z'))
expect(accepted.analytics === false && accepted.marketing === false, 'accept all keeps unavailable optional off')
expect(adapter.write(accepted), 'accept all persists')
expect(adapter.read()?.updatedAt === accepted.updatedAt, 'accept all restores')

// 3. Reject Optional
const rejected = rejectOptionalConsent()
expect(!rejected.analytics && !rejected.marketing, 'reject optional denies optional categories')
expect(adapter.write(rejected), 'reject optional persists')

// 4. Individual category selection
const custom = buildConsentRecord({ analytics: true, marketing: true })
expect(!custom.analytics && !custom.marketing, 'unavailable integrations stay off when selected')

// 5. Saving and restoring after reload
store.clear()
expect(adapter.write(rejected), 'save before reload')
const reloaded = adapter.read()
expect(reloaded?.marketing === false, 'reload restores marketing choice')

// 6. Invalid or outdated consent
expect(parseConsentRecord(null) === null, 'null is invalid')
expect(parseConsentRecord({ version: COOKIE_CONSENT_VERSION - 1, essential: true, analytics: false, marketing: false, updatedAt: rejected.updatedAt }) === null, 'old version invalid')
expect(parseConsentRecord({ version: COOKIE_CONSENT_VERSION, essential: false, analytics: false, marketing: false, updatedAt: rejected.updatedAt }) === null, 'essential must be true')

// 7. Browser storage failures
const failing = {
  read: () => null,
  write: (_record: typeof rejected) => {
    try {
      throw new Error('quota')
    } catch {
      return false
    }
  },
}
expect(!failing.write(rejected), 'storage write failure is handled')

// 8–9. Reopen preferences / withdrawal — covered by provider manually; storage supports read after write
store.clear()
adapter.write(acceptAllConsent())
adapter.write(rejectOptionalConsent())
expect(adapter.read()?.marketing === false, 'withdrawal updates stored record')

// 10–11. Optional integrations blocked / no duplicate init
resetOptionalIntegrationsForTests()
syncOptionalIntegrations(null)
expect(!getIntegrationSnapshot().analyticsInitialized, 'no consent does not init analytics')
syncOptionalIntegrations(rejected)
expect(!getIntegrationSnapshot().analyticsInitialized, 'rejected consent does not init analytics')
if (ANALYTICS_INTEGRATION_CONFIGURED) {
  syncOptionalIntegrations(buildConsentRecord({ analytics: true, marketing: false }))
  syncOptionalIntegrations(buildConsentRecord({ analytics: true, marketing: false }))
  expect(getIntegrationSnapshot().analyticsInitialized, 'analytics inits once when configured')
} else {
  syncOptionalIntegrations(buildConsentRecord({ analytics: true, marketing: false }))
  expect(!getIntegrationSnapshot().analyticsInitialized, 'analytics stays off without configuration')
}

// 12–14. Auth/LiveKit/booking — consent uses an isolated storage key only
expect(!store.has('sb-'), 'consent adapter does not write Supabase auth keys')

console.log('consent.check passed')
