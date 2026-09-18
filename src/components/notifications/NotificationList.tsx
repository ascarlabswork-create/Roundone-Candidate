import { CalendarCheck, CalendarClock, CalendarX, CheckCircle2, Clock, MessageSquare, Bell } from 'lucide-react'
import type { CandidateNotification } from '../../services/notificationModel.ts'
import { formatNotificationTime, isUnread } from '../../services/notificationModel.ts'
import { cn } from '../../lib/cn.ts'

function KindIcon({ kind }: { kind: string }) {
  const className = 'h-4 w-4 shrink-0 text-slate-500'
  if (kind === 'booking_confirmed' || kind === 'interview_reminder') return <CalendarCheck className={className} />
  if (kind === 'booking_rescheduled') return <CalendarClock className={className} />
  if (kind === 'booking_rejected' || kind === 'booking_cancelled' || kind === 'booking_expired') {
    return <CalendarX className={className} />
  }
  if (kind === 'feedback_ready') return <MessageSquare className={className} />
  if (kind === 'interview_completed') return <CheckCircle2 className={className} />
  if (kind === 'booking_requested') return <Clock className={className} />
  return <Bell className={className} />
}

export function NotificationList({
  items,
  compact = false,
  onSelect,
}: {
  items: CandidateNotification[]
  compact?: boolean
  onSelect: (item: CandidateNotification) => void
}) {
  return (
    <ul className={compact ? 'divide-y divide-slate-100' : 'space-y-3'}>
      {items.map((item) => {
        const unread = isUnread(item)
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                'flex w-full gap-3 text-left transition-colors',
                compact
                  ? 'px-3 py-3 hover:bg-slate-50'
                  : 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300',
              )}
            >
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  unread ? 'bg-blue-600' : 'bg-transparent ring-1 ring-slate-300',
                )}
                aria-hidden
              />
              <KindIcon kind={item.kind} />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm text-navy-950', unread ? 'font-semibold' : 'font-medium')}>
                  {item.title}
                </span>
                <span className="mt-0.5 block text-sm text-slate-600">{item.body}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{formatNotificationTime(item.createdAt)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
