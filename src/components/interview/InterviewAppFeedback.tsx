import { useEffect, useState } from 'react'
import { normalizeAppFeedback } from '../../interview/roomExperience.ts'
import { supabase } from '../../lib/supabase.ts'
import { loadInterviewAppFeedback, saveInterviewAppFeedback } from '../../services/interviewRoomExperience.ts'
import { Button } from '../ui/Button.tsx'

const SKIP_PREFIX = 'roundone-app-feedback-skip:'

export function InterviewAppFeedback({ sessionId }: { sessionId: string }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [skipped, setSkipped] = useState(() => sessionStorage.getItem(`${SKIP_PREFIX}${sessionId}`) === '1')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (cancelled || !data.user) return
      setUserId(data.user.id)
      const existing = await loadInterviewAppFeedback(sessionId)
      if (cancelled || !existing) return
      setRating(existing.rating)
      setFeedback(existing.feedback)
      setSuggestions(existing.suggestions)
      setSubmitted(true)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (skipped) return null

  async function submit() {
    if (!userId) return
    if (!normalizeAppFeedback({ rating, feedback, suggestions })) {
      setError('Add a rating or a comment before sending.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveInterviewAppFeedback(sessionId, userId, { rating, feedback, suggestions })
      setSubmitted(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send feedback.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
      <h2 className="text-base font-semibold text-navy-950">How was your RoundOne interview experience?</h2>
      {submitted ? (
        <p className="mt-2 text-sm text-slate-600">Thanks. Your feedback stays with your account.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">Optional. This is about the RoundOne app, not the other person.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Overall experience">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={rating === value}
                className={`h-9 w-9 rounded-md border text-sm ${
                  rating === value ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-300 bg-white text-navy-950'
                }`}
                onClick={() => setRating(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm text-slate-700">
            Comments, bugs, or feature requests
            <textarea
              value={feedback}
              maxLength={4000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2"
              onChange={(event) => setFeedback(event.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm text-slate-700">
            Suggestions
            <textarea
              value={suggestions}
              maxLength={4000}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2"
              onChange={(event) => setSuggestions(event.target.value)}
            />
          </label>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={saving || !userId} onClick={() => void submit()}>
              {saving ? 'Sending...' : 'Submit feedback'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                sessionStorage.setItem(`${SKIP_PREFIX}${sessionId}`, '1')
                setSkipped(true)
              }}
            >
              Skip
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
