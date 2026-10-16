import { ShieldCheck, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { COOKIE_CATEGORIES } from '../../consent/consentModel.ts'
import { useCookieConsent } from '../../state/cookieConsent.tsx'
import { Button } from '../ui/Button.tsx'

export function CookieConsentUI() {
  const {
    panel,
    consent,
    draftAnalytics,
    draftMarketing,
    storageError,
    acceptAll,
    rejectOptional,
    openCookiePreferences,
    setDraftAnalytics,
    setDraftMarketing,
    savePreferences,
    cancelPreferences,
  } = useCookieConsent()

  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const open = panel === 'banner' || panel === 'preferences'

  useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    const focusable = node?.querySelector<HTMLElement>('button, [href], input:not([disabled])')
    focusable?.focus()
  }, [open, panel])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') cancelPreferences()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cancelPreferences, open])

  if (!open) return null

  const preferences = panel === 'preferences'
  const analyticsMeta = COOKIE_CATEGORIES.find((item) => item.id === 'analytics')!
  const marketingMeta = COOKIE_CATEGORIES.find((item) => item.id === 'marketing')!

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-navy-950/60"
        aria-label="Dismiss cookie dialog backdrop"
        onClick={() => cancelPreferences()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 text-white" aria-hidden>
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold text-navy-950">
                {preferences ? 'Cookie preferences' : 'Your privacy, your choice.'}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {preferences
                  ? 'Review each category. Essential cookies stay on so sign-in and core features work.'
                  : 'We use essential storage for sign-in and core features. Optional analytics and marketing are off unless you allow them—and none are active in this app today.'}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950"
              aria-label="Close cookie preferences"
              onClick={() => cancelPreferences()}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {preferences ? (
            <ul className="space-y-4">
              {COOKIE_CATEGORIES.map((category) => (
                <li key={category.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy-950">{category.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{category.description}</p>
                      {!category.available && !category.required ? (
                        <p className="mt-2 text-xs font-medium text-slate-500">Not in use in this application</p>
                      ) : null}
                    </div>
                    {category.id === 'essential' ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        Always on
                      </span>
                    ) : category.id === 'analytics' ? (
                      <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-navy-950">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-navy-950 focus:ring-blue-600"
                          checked={draftAnalytics}
                          disabled={!analyticsMeta.available}
                          onChange={(event) => setDraftAnalytics(event.target.checked)}
                        />
                        {analyticsMeta.available ? 'Allow' : 'Unavailable'}
                      </label>
                    ) : (
                      <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-navy-950">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-navy-950 focus:ring-blue-600"
                          checked={draftMarketing}
                          disabled={!marketingMeta.available}
                          onChange={(event) => setDraftMarketing(event.target.checked)}
                        />
                        {marketingMeta.available ? 'Allow' : 'Unavailable'}
                      </label>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              Read more in our{' '}
              <a href="/cookies" className="font-medium text-navy-950 underline underline-offset-2">
                Cookie Policy
              </a>
              .
            </p>
          )}
          {storageError ? <p className="mt-3 text-sm text-amber-800">{storageError}</p> : null}
          {preferences && consent ? (
            <p className="mt-4 text-xs text-slate-500">
              Current saved choice: Analytics {consent.analytics ? 'on' : 'off'}, Marketing {consent.marketing ? 'on' : 'off'}.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          {preferences ? (
            <>
              <Button type="button" fullWidth onClick={() => savePreferences()}>
                Save preferences
              </Button>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" fullWidth onClick={() => acceptAll()}>
                  Accept all
                </Button>
                <Button type="button" variant="outline" fullWidth onClick={() => rejectOptional()}>
                  Reject optional
                </Button>
              </div>
              <Button type="button" variant="ghost" fullWidth onClick={() => cancelPreferences()}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button type="button" fullWidth onClick={() => acceptAll()}>
                Accept all
              </Button>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" fullWidth onClick={() => rejectOptional()}>
                  Reject optional
                </Button>
                <Button type="button" variant="outline" fullWidth onClick={() => openCookiePreferences()}>
                  Customize preferences
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
