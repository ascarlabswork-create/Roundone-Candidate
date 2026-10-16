import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  acceptAllConsent,
  buildConsentRecord,
  COOKIE_CONSENT_STORAGE_KEY,
  defaultOptionalDenied,
  hasValidConsent,
  rejectOptionalConsent,
  type CookieConsentRecord,
} from '../consent/consentModel.ts'
import { readStoredConsent, writeStoredConsent } from '../consent/consentStorage.ts'
import { syncOptionalIntegrations } from '../consent/optionalIntegrations.ts'

type PanelMode = 'closed' | 'banner' | 'preferences'

type CookieConsentContextValue = {
  consent: CookieConsentRecord | null
  hasDecided: boolean
  panel: PanelMode
  draftAnalytics: boolean
  draftMarketing: boolean
  storageError: string | null
  openCookiePreferences: () => void
  closePanel: () => void
  acceptAll: () => void
  rejectOptional: () => void
  setDraftAnalytics: (value: boolean) => void
  setDraftMarketing: (value: boolean) => void
  savePreferences: () => void
  cancelPreferences: () => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)

function applyConsent(record: CookieConsentRecord | null) {
  syncOptionalIntegrations(record)
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentRecord | null>(() => readStoredConsent())
  const [panel, setPanel] = useState<PanelMode>(() => (hasValidConsent(readStoredConsent()) ? 'closed' : 'banner'))
  const [draftAnalytics, setDraftAnalytics] = useState(false)
  const [draftMarketing, setDraftMarketing] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const initialized = useRef(false)

  const hasDecided = hasValidConsent(consent)

  const syncDraftFromConsent = useCallback((record: CookieConsentRecord | null) => {
    if (record) {
      setDraftAnalytics(record.analytics)
      setDraftMarketing(record.marketing)
    } else {
      setDraftAnalytics(defaultOptionalDenied().analytics)
      setDraftMarketing(defaultOptionalDenied().marketing)
    }
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const stored = readStoredConsent()
    applyConsent(stored)
    syncDraftFromConsent(stored)
  }, [syncDraftFromConsent])

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== COOKIE_CONSENT_STORAGE_KEY) return
      const next = readStoredConsent()
      setConsent(next)
      applyConsent(next)
      syncDraftFromConsent(next)
      if (hasValidConsent(next)) setPanel('closed')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [syncDraftFromConsent])

  const persist = useCallback(
    (record: CookieConsentRecord) => {
      const ok = writeStoredConsent(record)
      if (!ok) {
        setStorageError('Your browser could not save cookie preferences. Try again or check site storage settings.')
        return false
      }
      setStorageError(null)
      setConsent(record)
      applyConsent(record)
      syncDraftFromConsent(record)
      setPanel('closed')
      return true
    },
    [syncDraftFromConsent],
  )

  const openCookiePreferences = useCallback(() => {
    syncDraftFromConsent(consent)
    setPanel('preferences')
  }, [consent, syncDraftFromConsent])

  const closePanel = useCallback(() => {
    setPanel(hasValidConsent(consent) ? 'closed' : 'banner')
  }, [consent])

  const acceptAll = useCallback(() => {
    void persist(acceptAllConsent())
  }, [persist])

  const rejectOptional = useCallback(() => {
    void persist(rejectOptionalConsent())
  }, [persist])

  const savePreferences = useCallback(() => {
    void persist(buildConsentRecord({ analytics: draftAnalytics, marketing: draftMarketing }))
  }, [draftAnalytics, draftMarketing, persist])

  const cancelPreferences = useCallback(() => {
    syncDraftFromConsent(consent)
    setPanel(hasValidConsent(consent) ? 'closed' : 'banner')
  }, [consent, syncDraftFromConsent])

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      hasDecided,
      panel,
      draftAnalytics,
      draftMarketing,
      storageError,
      openCookiePreferences,
      closePanel,
      acceptAll,
      rejectOptional,
      setDraftAnalytics,
      setDraftMarketing,
      savePreferences,
      cancelPreferences,
    }),
    [
      acceptAll,
      cancelPreferences,
      closePanel,
      consent,
      draftAnalytics,
      draftMarketing,
      hasDecided,
      openCookiePreferences,
      panel,
      rejectOptional,
      savePreferences,
      storageError,
    ],
  )

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider')
  return ctx
}
