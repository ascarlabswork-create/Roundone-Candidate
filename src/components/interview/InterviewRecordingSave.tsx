import { useEffect, useState } from 'react'
import { chooseRecordingFile, writeRecordingFile } from '../../interview/saveRecordingFile.ts'
import { canSaveInterviewRecording, type InterviewRecordingState } from '../../interview/roomExperience.ts'
import { loadInterviewRecording, requestInterviewRecording } from '../../services/interviewRoomExperience.ts'
import { Button } from '../ui/Button.tsx'

export function InterviewRecordingSave({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<InterviewRecordingState>('idle')
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadInterviewRecording(sessionId).then((snapshot) => {
      if (cancelled) return
      setStatus(snapshot.status)
      setStoragePath(snapshot.storagePath)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (!canSaveInterviewRecording(status, storagePath) && status !== 'recording') return null

  async function change(action: 'stop' | 'save') {
    setBusy(true)
    setError(null)
    try {
      if (action === 'stop') {
        const snapshot = await requestInterviewRecording(sessionId, 'stop')
        setStatus(snapshot.status)
        if (snapshot.storagePath) setStoragePath(snapshot.storagePath)
        return
      }
      const chosen = await chooseRecordingFile()
      if (chosen === 'cancelled') return
      const snapshot = await requestInterviewRecording(sessionId, 'save')
      if (!snapshot.downloadUrl) {
        setError('The recording is still being saved to this interview. Try Save again in a moment.')
        return
      }
      await writeRecordingFile(snapshot.downloadUrl, chosen)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recording could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 w-full rounded-xl border border-slate-200 bg-white p-4 text-left">
      <h2 className="font-semibold text-navy-950">Interview recording</h2>
      <p className="mt-1 text-sm text-slate-600">
        {status === 'recording'
          ? 'Recording is in progress. Stop it when you are done, then save a copy to your computer.'
          : 'Stored privately with this interview. Save puts a copy in a folder you choose.'}
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {status === 'recording' ? (
          <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void change('stop')}>
            {busy ? 'Stopping…' : 'Stop recording'}
          </Button>
        ) : canSaveInterviewRecording(status, storagePath) ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void change('save')}>
            {busy ? 'Saving…' : 'Save to computer'}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
