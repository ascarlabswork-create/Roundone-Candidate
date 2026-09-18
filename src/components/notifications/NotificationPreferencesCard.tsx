import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, ErrorState, Skeleton, Toggle } from '../ui/primitives.tsx'
import {
  NotificationError,
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
  type CandidateNotificationPreferences,
  type NotificationPreferenceUpdate,
} from '../../services/notifications.ts'

type OptionalKey = 'bookingUpdates' | 'feedbackUpdates'

const OPTIONS: Array<{
  key: OptionalKey
  title: string
  description: string
}> = [
  {
    key: 'bookingUpdates',
    title: 'Interview reminders',
    description: 'Get a reminder shortly before a confirmed interview starts.',
  },
  {
    key: 'feedbackUpdates',
    title: 'Feedback available',
    description: 'Get notified when your interviewer submits private feedback.',
  },
]

export function NotificationPreferencesCard() {
  const [prefs, setPrefs] = useState<CandidateNotificationPreferences | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<OptionalKey | null>(null)
  const [savedKey, setSavedKey] = useState<OptionalKey | null>(null)
  const savingRef = useRef(false)

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const next = await getMyNotificationPreferences()
      setPrefs(next)
      setStatus('ready')
    } catch (caught) {
      setPrefs(null)
      setStatus('error')
      setError(caught instanceof NotificationError ? caught.message : 'Unable to load your notification preferences.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onToggle(key: OptionalKey, nextValue: boolean) {
    if (!prefs || savingRef.current) return
    const previous = prefs
    const patch: NotificationPreferenceUpdate = { [key]: nextValue }
    savingRef.current = true
    setPrefs({ ...prefs, [key]: nextValue })
    setSavingKey(key)
    setSavedKey(null)
    setError(null)
    try {
      const saved = await updateMyNotificationPreferences(patch)
      setPrefs(saved)
      setSavedKey(key)
    } catch (caught) {
      setPrefs(previous)
      setError(caught instanceof NotificationError ? caught.message : 'Unable to update your notification preferences.')
    } finally {
      savingRef.current = false
      setSavingKey(null)
    }
  }

  return (
    <Card className="mt-8 p-6">
      <h2 id="notifications" className="font-semibold text-navy-950">Notification Preferences</h2>
      <p className="mt-1 text-sm text-slate-600">
        Booking confirmations, cancellations, and schedule changes are always sent. You can turn optional reminders and
        feedback alerts on or off.
      </p>

      {status === 'loading' ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : null}

      {status === 'error' && !prefs ? (
        <div className="mt-5">
          <ErrorState title="Unable to load notification preferences" body={error ?? ''} onRetry={() => void load()} />
        </div>
      ) : null}

      {status === 'ready' && prefs ? (
        <ul className="mt-5 divide-y divide-slate-100">
          {OPTIONS.map((option) => {
            const checked = prefs[option.key]
            const saving = savingKey === option.key
            return (
              <li key={option.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-navy-950">{option.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                  {saving ? <p className="mt-1 text-xs text-slate-500">Saving…</p> : null}
                  {!saving && savedKey === option.key ? (
                    <p className="mt-1 text-xs text-emerald-700">Saved</p>
                  ) : null}
                </div>
                <Toggle
                  checked={checked}
                  disabled={savingKey !== null}
                  label={option.title}
                  onChange={(next) => void onToggle(option.key, next)}
                />
              </li>
            )
          })}
        </ul>
      ) : null}

      {error && prefs ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </Card>
  )
}
