import { SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  chatSenderLabel,
  formatChatTime,
  INTERVIEW_MESSAGE_MAX,
  normalizeInterviewMessage,
  type InterviewChatMessage,
} from '../../interview/roomExperience.ts'
import { Button } from '../ui/Button.tsx'

export function InterviewChatPanel({
  messages,
  userId,
  remoteName,
  sending,
  error,
  onSend,
  onClose,
}: {
  messages: InterviewChatMessage[]
  userId: string
  remoteName: string
  sending: boolean
  error: string | null
  onSend: (message: string) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function submit() {
    const message = normalizeInterviewMessage(draft)
    if (!message) {
      setLocalError(draft.trim() ? `Keep messages under ${INTERVIEW_MESSAGE_MAX} characters.` : null)
      return
    }
    setLocalError(null)
    try {
      await onSend(message)
      setDraft('')
    } catch {
      // The room keeps the draft and shows the send error.
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-white text-slate-800">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-navy-950">Chat</h2>
        <button type="button" className="text-sm text-slate-500 hover:text-navy-950" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Messages stay in this interview.</p>
        ) : (
          messages.map((item) => {
            const mine = item.senderUserId === userId
            return (
              <article key={item.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <p className="text-xs text-slate-500">
                  {chatSenderLabel(item.senderUserId, userId, remoteName)}
                  {formatChatTime(item.createdAt) ? ` · ${formatChatTime(item.createdAt)}` : ''}
                </p>
                <p
                  className={`mt-1 max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                    mine ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {item.message}
                </p>
              </article>
            )
          })
        )}
        <div ref={endRef} />
      </div>
      <form
        className="border-t border-slate-200 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <textarea
          value={draft}
          maxLength={INTERVIEW_MESSAGE_MAX}
          rows={2}
          aria-label="Message"
          placeholder="Message"
          className="w-full resize-none rounded-lg border border-slate-200 p-2 text-sm"
          onChange={(event) => {
            setDraft(event.target.value)
            setLocalError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        {localError || error ? <p className="mt-2 text-xs text-red-600">{localError ?? error}</p> : null}
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            <SendHorizontal className="h-4 w-4" />
            Send
          </Button>
        </div>
      </form>
    </section>
  )
}
