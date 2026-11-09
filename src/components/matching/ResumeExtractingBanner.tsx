import { useEffect, useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'

const ANALYZE_MESSAGES = [
  'Scanning skills, tools, and platforms…',
  'Reading projects and experience…',
  'Keeping only technical skills…',
  'Building your review list…',
]

export function ResumeExtractingBanner({
  fileName,
  status,
}: {
  fileName?: string | null
  status: string | null
}) {
  const label = status?.trim() || 'Extracting skills from resume…'
  const lower = label.toLowerCase()
  const reading = lower.includes('reading')
  const analyzing = lower.includes('analyz') || lower.includes('extract')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!analyzing || reading) return
    const id = window.setInterval(() => setTick((value) => value + 1), 1600)
    return () => window.clearInterval(id)
  }, [analyzing, reading])

  const liveLabel = reading
    ? label
    : analyzing
      ? ANALYZE_MESSAGES[tick % ANALYZE_MESSAGES.length]
      : label

  return (
    <div
      className="relative mt-3 overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-coral-50 via-violet-50 to-sky-50 p-4 shadow-[0_12px_32px_-24px_rgba(79,70,229,0.55)] sm:p-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-coral-400/30 to-violet-400/40 blur-2xl motion-safe:animate-pulse"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-gradient-to-tr from-sky-400/25 to-mint-500/20 blur-2xl motion-safe:animate-pulse"
        aria-hidden
      />

      <div className="relative flex items-start gap-3">
        <span className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-coral-600 via-violet-500 to-sky-500 text-white shadow-md shadow-violet-500/30">
          <Sparkles className="h-5 w-5 motion-safe:animate-pulse" aria-hidden />
          <span
            className="absolute inset-0 rounded-2xl border-2 border-white/40 motion-safe:animate-ping opacity-40"
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-navy-950">
              {reading ? 'Reading your resume' : analyzing ? 'Extracting technical skills' : 'Working on your resume'}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-200">
              <span className="flex gap-0.5" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-coral-500 motion-safe:animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 motion-safe:animate-bounce [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 motion-safe:animate-bounce [animation-delay:240ms]" />
              </span>
              Live
            </span>
          </div>
          <p className="mt-1 min-h-5 text-sm text-slate-600 transition-opacity">{liveLabel}</p>
          {fileName ? (
            <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1 text-xs font-medium text-navy-800 ring-1 ring-violet-100">
              <FileText className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
              <span className="truncate">{fileName}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-violet-100">
        <div className="resume-extract-shimmer absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-coral-500 via-violet-500 to-sky-500" />
      </div>

      <div className="relative mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { id: 1, title: 'Read resume', active: reading, done: !reading },
          { id: 2, title: 'Find tech skills', active: !reading && analyzing, done: false },
          { id: 3, title: 'Ready to review', active: false, done: false },
        ].map((step) => (
          <div
            key={step.id}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              step.active
                ? 'bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-sm shadow-violet-600/30'
                : step.done
                  ? 'bg-white/80 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-white/70 text-slate-400 ring-1 ring-slate-200'
            }`}
          >
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px]">
              {step.id}
            </span>
            {step.title}
          </div>
        ))}
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-hidden>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-8 rounded-lg bg-white/55 ring-1 ring-violet-100 motion-safe:animate-pulse"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
