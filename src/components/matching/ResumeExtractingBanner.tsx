import { FileText, Sparkles } from 'lucide-react'

export function ResumeExtractingBanner({
  fileName,
  status,
}: {
  fileName: string
  status: string | null
}) {
  const reading = (status ?? '').toLowerCase().includes('reading')
  const label = status?.trim() || 'Extracting skills from resume…'

  return (
    <div
      className="relative mt-3 overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-coral-50 via-violet-50 to-sky-50 p-4 shadow-[0_12px_32px_-24px_rgba(79,70,229,0.55)]"
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
              {reading ? 'Reading your resume' : 'Extracting skills'}
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
          <p className="mt-1 text-sm text-slate-600">{label}</p>
          <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1 text-xs font-medium text-navy-800 ring-1 ring-violet-100">
            <FileText className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
            <span className="truncate">{fileName}</span>
          </p>
        </div>
      </div>

      <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-violet-100">
        <div className="resume-extract-shimmer absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-coral-500 via-violet-500 to-sky-500" />
      </div>
      <div className="relative mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
        <span
          className={`rounded-full px-2.5 py-1 ${
            reading
              ? 'bg-coral-600 text-white shadow-sm shadow-coral-600/30'
              : 'bg-white/80 text-emerald-700 ring-1 ring-emerald-200'
          }`}
        >
          1 · Read file
        </span>
        <span
          className={`rounded-full px-2.5 py-1 ${
            !reading
              ? 'bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-sm shadow-violet-600/30'
              : 'bg-white/70 text-slate-500 ring-1 ring-slate-200'
          }`}
        >
          2 · Extract skills
        </span>
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-slate-400 ring-1 ring-slate-200">
          3 · Apply to form
        </span>
      </div>
    </div>
  )
}
