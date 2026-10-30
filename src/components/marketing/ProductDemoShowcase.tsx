import { useEffect, useState } from 'react'
import { BadgeCheck, Calendar, MessageSquare, Sparkles, Target, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/cn.ts'

const scenes = [
  {
    id: 'ai',
    label: 'AI mock interview',
    title: 'Live AI practice session',
    body: 'Answer real interview questions and get scored feedback after each round.',
    icon: Sparkles,
    accent: 'bg-coral-50 text-coral-700',
  },
  {
    id: 'job',
    label: 'Job-specific prep',
    title: 'Matched to your target role',
    body: 'Paste a job posting or pick skills — preparation follows the role you are targeting.',
    icon: Target,
    accent: 'bg-sky-50 text-sky-700',
  },
  {
    id: 'match',
    label: 'Interviewer matching',
    title: 'Ranked by skill overlap',
    body: 'See why each professional fits your stack before you book.',
    icon: BadgeCheck,
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'book',
    label: 'Book a human round',
    title: 'Pick a time and confirm',
    body: 'Choose a service, select a slot, and join a live video mock interview.',
    icon: Calendar,
    accent: 'bg-violet-50 text-violet-700',
  },
  {
    id: 'feedback',
    label: 'Performance feedback',
    title: 'Scorecard you can reuse',
    body: 'Structured scores and notes — not a vague “you did fine.”',
    icon: TrendingUp,
    accent: 'bg-amber-50 text-amber-800',
  },
] as const

export function ProductDemoShowcase() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const scene = scenes[index]
  const Icon = scene.icon

  useEffect(() => {
    if (paused) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % scenes.length)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [paused])

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-32px_rgba(16,28,53,0.45)]">
        <div className="flex items-center gap-2 border-b border-black/[0.06] bg-[#f5f7fa] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
          <span className="ml-2 truncate text-xs font-medium text-slate-500">jobround.ai — candidate studio</span>
        </div>
        <div className="grid gap-0 lg:grid-cols-[11rem_1fr]">
          <div className="hidden border-r border-black/[0.06] bg-[#f5f7fa] p-3 lg:block">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Demo tour</p>
            <ul className="mt-2 space-y-1">
              {scenes.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      'w-full rounded-lg px-2 py-2 text-left text-xs font-medium transition-colors',
                      i === index ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600 hover:bg-white/70',
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', scene.accent)}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {scene.label}
              </span>
              <button
                type="button"
                className="rounded-lg border border-black/[0.08] px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-black/[0.03]"
                onClick={() => setPaused((value) => !value)}
                aria-pressed={paused}
              >
                {paused ? 'Play demo' : 'Pause demo'}
              </button>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-navy-950">{scene.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{scene.body}</p>
            <div className="mt-5 rounded-xl border border-black/[0.06] bg-[#f5f7fa] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-950 text-sm font-bold text-white">
                  JR
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-950">Candidate workspace</p>
                  <p className="text-xs text-slate-500">Mock interview · 45 min</p>
                </div>
                <MessageSquare className="h-5 w-5 text-coral-600" aria-hidden />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-coral-600 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: `${((index + 1) / scenes.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Step {index + 1} of {scenes.length} — actual product flows shown in the app after sign-in.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500 lg:text-left">
        Interactive product preview — built from JobRound.ai candidate flows (no stock video).
      </p>
    </div>
  )
}
