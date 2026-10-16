import type { CookieConsentRecord } from './consentModel.ts'
import { hasValidConsent } from './consentModel.ts'

/**
 * Optional vendors are off until both configured and consented.
 * No analytics or marketing SDK is bundled in the candidate app today.
 */
function readEnvFlag(name: string) {
  try {
    return Boolean(import.meta.env?.[name])
  } catch {
    return false
  }
}

export const ANALYTICS_INTEGRATION_CONFIGURED = readEnvFlag('VITE_ANALYTICS_ID')
export const MARKETING_INTEGRATION_CONFIGURED = readEnvFlag('VITE_MARKETING_ID')

let analyticsInitialized = false
let marketingInitialized = false

export type IntegrationSnapshot = {
  analyticsInitialized: boolean
  marketingInitialized: boolean
}

export function getIntegrationSnapshot(): IntegrationSnapshot {
  return { analyticsInitialized, marketingInitialized }
}

function initAnalytics() {
  if (analyticsInitialized || !ANALYTICS_INTEGRATION_CONFIGURED) return
  // Placeholder: load analytics only after explicit consent.
  analyticsInitialized = true
}

function initMarketing() {
  if (marketingInitialized || !MARKETING_INTEGRATION_CONFIGURED) return
  marketingInitialized = true
}

function shutdownAnalytics() {
  analyticsInitialized = false
}

function shutdownMarketing() {
  marketingInitialized = false
}

export function syncOptionalIntegrations(consent: CookieConsentRecord | null) {
  if (!hasValidConsent(consent)) {
    shutdownAnalytics()
    shutdownMarketing()
    return
  }
  if (consent.analytics && ANALYTICS_INTEGRATION_CONFIGURED) initAnalytics()
  else shutdownAnalytics()
  if (consent.marketing && MARKETING_INTEGRATION_CONFIGURED) initMarketing()
  else shutdownMarketing()
}

/** For tests: reset module state. */
export function resetOptionalIntegrationsForTests() {
  analyticsInitialized = false
  marketingInitialized = false
}
