import { useEffect, useRef, useState } from 'react'
import { INTERVIEW_NOTES_MAX } from '../../interview/roomExperience.ts'
import { supabase } from '../../lib/supabase.ts'
import { loadInterviewNotes, saveInterviewNotes } from '../../services/interviewRoomExperience.ts'
import { Button } from '../ui/Button.tsx'

export function InterviewNotesPanel({
  notes,
  status,
  onChange,
  onSave,
  onClose,
}: {
  notes: string
  status: 'idle' | 'saving' | 'saved' | 'error'
  onChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}) {
  const label = status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : status === 'error' ? 'Could not save notes.' : 'Only you can see these notes.'
  return (
    <section className="flex h-full min-h-0 flex-col bg-white text-slate-800">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-navy-950">Notes</h2>
        <button type="button" className="text-sm text-slate-500 hover:text-navy-950" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <textarea
          value={notes}
          maxLength={INTERVIEW_NOTES_MAX}
          aria-label="Private notes"
          placeholder="Private notes. Only you can see these."
          className="min-h-40 w-full flex-1 resize-none rounded-lg border border-slate-200 p-3 text-sm"
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{label}</p>
          <Button type="button" size="sm" variant="outline" onClick={onSave} disabled={status === 'saving'}>
            Save
          </Button>
        </div>
      </div>
    </section>
  )
}

export function InterviewNotesCard({ sessionId }: { sessionId: string }) {
  const [userId, setUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const ready = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) setUserId(data.user.id)
    })
    void loadInterviewNotes(sessionId)
      .then((value) => {
        if (cancelled) return
        setNotes(value)
        ready.current = true
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [sessionId])

  async function persist(value: string) {
    if (!userId) return
    setStatus('saving')
    try {
      await saveInterviewNotes(sessionId, userId, value)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  const label =
    status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : status === 'error' ? 'Could not save notes.' : 'Only you can see these notes.'

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left">
      <h2 className="font-semibold text-navy-950">Your private notes</h2>
      <textarea
        value={notes}
        maxLength={INTERVIEW_NOTES_MAX}
        aria-label="Private notes"
        placeholder="Private notes. Only you can see these."
        className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 p-3 text-sm"
        onChange={(event) => {
          const value = event.target.value
          setNotes(value)
          if (!ready.current || !userId) return
          if (timer.current != null) window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => void persist(value), 800)
        }}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{label}</p>
        <Button type="button" size="sm" variant="outline" disabled={status === 'saving' || !userId} onClick={() => void persist(notes)}>
          Save
        </Button>
      </div>
    </section>
  )
}
