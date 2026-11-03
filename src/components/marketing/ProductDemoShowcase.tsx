import { BadgeCheck, Calendar, MessageSquare, Play, Sparkles, Target, TrendingUp } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { getDemoVideoUrl, getDemoYouTubeId, youtubeEmbedUrl } from '../../lib/demoMedia.ts'

/** Human live booking leads; AI practice comes after matching and job prep. */
const scenes = [
  {
    id: 'book',
    label: 'Book a human round',
    title: 'Pick a time and confirm',
    body: 'Choose a service, select a slot, and join a live video mock with a real interviewer.',
    narration:
      'Start with a live human mock. Match with a working professional, pick a service and time, then join a real video interview from your browser.',
    icon: Calendar,
    accent: 'bg-violet-100 text-violet-700 ring-violet-200',
    bar: 'from-violet-500 to-sky-400',
    chip: 'Mock interview · 45 min',
  },
  {
    id: 'match',
    label: 'Interviewer matching',
    title: 'Ranked by skill overlap',
    body: 'See why each professional fits your stack before you book.',
    narration:
      'Browse interviewers ranked by overlap with your stack. Each profile explains why they are a strong fit before you book.',
    icon: BadgeCheck,
    accent: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    bar: 'from-emerald-500 to-mint-500',
    chip: 'Skill overlap · ranked fits',
  },
  {
    id: 'job',
    label: 'Job-specific prep',
    title: 'Matched to your target role',
    body: 'Paste a job posting or pick skills — preparation follows the role you are targeting.',
    narration:
      'Add a target job or résumé. JobRound tailors practice and prep to the role and skills you care about, not generic flashcards.',
    icon: Target,
    accent: 'bg-sky-100 text-sky-700 ring-sky-200',
    bar: 'from-sky-500 to-violet-400',
    chip: 'Target role · prep plan',
  },
  {
    id: 'ai',
    label: 'AI mock interview',
    title: 'Practice between live rounds',
    body: 'Answer real interview questions and get scored feedback after each AI practice session.',
    narration:
      'Between live bookings, use AI mock interviews. Answer real prompts, get scored feedback, and sharpen your answers before the next human round.',
    icon: Sparkles,
    accent: 'bg-coral-100 text-coral-700 ring-coral-200',
    bar: 'from-coral-500 to-amber-400',
    chip: 'AI practice · scored',
  },
  {
    id: 'feedback',
    label: 'Performance feedback',
    title: 'Scorecard you can reuse',
    body: 'Structured scores and notes — not a vague “you did fine.”',
    narration:
      'After each session, review structured scores and notes on a scorecard you can revisit as you improve.',
    icon: TrendingUp,
    accent: 'bg-amber-100 text-amber-800 ring-amber-200',
    bar: 'from-amber-500 to-rose-400',
    chip: 'Scorecard · next steps',
  },
] as const

const POSTER = '/demo/poster.svg'

type DemoMode = 'loading' | 'file' | 'youtube' | 'guided'

function DemoChrome({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-gradient-to-r from-coral-400/25 via-violet-400/30 to-sky-400/25 blur-2xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-white shadow-[0_28px_70px_-36px_rgba(79,70,229,0.4)]">
        <div className="flex items-center gap-2 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-violet-50/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
          <span className="ml-2 truncate text-xs font-medium text-slate-500">jobround.ai — candidate studio</span>
        </div>
        {children}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500 lg:text-left">{caption}</p>
    </div>
  )
}

function HostedDemoVideo({ src: initialSrc }: { src: string }) {
  const [src, setSrc] = useState(initialSrc)
  return (
    <DemoChrome caption="Product walkthrough — use the player controls for playback and volume.">
      <div className="aspect-video w-full bg-black">
        <video
          className="h-full w-full object-contain"
          controls
          playsInline
          preload="metadata"
          poster={POSTER}
          src={src}
          onError={() => {
            if (src.endsWith('.mp4')) setSrc(src.replace(/\.mp4$/i, '.webm'))
          }}
        />
      </div>
    </DemoChrome>
  )
}

function YouTubeDemoVideo({ videoId }: { videoId: string }) {
  const [active, setActive] = useState(false)

  return (
    <DemoChrome caption="Hosted demo video with audio — click play to start.">
      <div className="relative aspect-video w-full bg-black">
        {!active ? (
          <button
            type="button"
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-cover bg-center"
            style={{ backgroundImage: `url(${POSTER})` }}
            onClick={() => setActive(true)}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-coral-600 shadow-lg transition group-hover:scale-105">
              <Play className="ml-1 h-8 w-8 fill-current" aria-hidden />
            </span>
            <span className="rounded-full bg-black/50 px-4 py-1.5 text-sm font-medium text-white">Play demo with sound</span>
          </button>
        ) : (
          <iframe
            title="JobRound.ai product demo"
            className="h-full w-full border-0"
            src={youtubeEmbedUrl(videoId, true)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </DemoChrome>
  )
}

function GuidedDemoTour() {
  const [index, setIndex] = useState(0)
  const scene = scenes[index]
  const Icon = scene.icon

  return (
    <DemoChrome caption="Click any step in the tour to open that flow — nothing auto-plays or advances.">
      <div className="grid min-h-[22rem] bg-gradient-to-br from-white via-sky-50/40 to-violet-50/50 lg:min-h-[26rem] lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200/80 bg-gradient-to-b from-navy-950 to-[#1a2a55] px-3 py-4 text-white lg:border-b-0 lg:border-r lg:border-white/10">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/90">Demo tour</p>
          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Demo scenes">
            {scenes.map((item, i) => {
              const ItemIcon = item.icon
              const active = i === index
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition',
                    active
                      ? 'bg-white text-navy-950 shadow-md shadow-violet-900/20'
                      : 'text-blue-100/85 hover:bg-white/10',
                  )}
                  onClick={() => setIndex(i)}
                  aria-current={active ? 'step' : undefined}
                >
                  <ItemIcon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-violet-600' : 'text-sky-300')} aria-hidden />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex flex-col">
          <div className="flex flex-1 flex-col px-5 py-5 sm:px-8 sm:py-7">
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                scene.accent,
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {scene.label}
            </span>

            <h3 className="mt-5 text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">{scene.title}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">{scene.body}</p>

            <div className="mt-auto pt-6">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-[0_16px_40px_-28px_rgba(16,28,53,0.45)] backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-sky-500 text-sm font-bold text-white shadow-md">
                    JR
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-950">Candidate workspace</p>
                    <p className="text-xs text-slate-500">{scene.chip}</p>
                  </div>
                  <MessageSquare className="h-5 w-5 text-sky-500" aria-hidden />
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      'h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out motion-reduce:transition-none',
                      scene.bar,
                    )}
                    style={{ width: `${((index + 1) / scenes.length) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Step {index + 1} of {scenes.length} — pick a step in the tour to open that flow.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-white/70 px-5 py-3 sm:px-8">
            <p className="text-sm leading-snug text-slate-600" aria-live="polite">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">Overview · </span>
              {scene.narration}
            </p>
          </div>
        </div>
      </div>
    </DemoChrome>
  )
}

export function ProductDemoShowcase() {
  const youtubeId = getDemoYouTubeId()
  const fileUrl = getDemoVideoUrl()
  /** Prefer the interactive human-first tour unless a hosted URL/YouTube id is configured. */
  const [mode, setMode] = useState<DemoMode>(() => (youtubeId ? 'youtube' : fileUrl ? 'loading' : 'guided'))

  useEffect(() => {
    if (youtubeId) {
      setMode('youtube')
      return
    }
    if (!fileUrl) {
      setMode('guided')
      return
    }

    let cancelled = false
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    const onOk = () => {
      if (!cancelled) setMode('file')
    }
    const onFail = () => {
      if (!cancelled) setMode('guided')
    }
    let triedWebm = false
    const onErr = () => {
      if (!triedWebm && fileUrl.endsWith('.mp4')) {
        triedWebm = true
        probe.src = fileUrl.replace(/\.mp4$/i, '.webm')
        return
      }
      onFail()
    }
    probe.addEventListener('loadedmetadata', onOk)
    probe.addEventListener('error', onErr)
    probe.src = fileUrl

    const timeout = window.setTimeout(onFail, 4000)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      probe.removeEventListener('loadedmetadata', onOk)
      probe.removeEventListener('error', onErr)
      probe.removeAttribute('src')
      probe.load()
    }
  }, [fileUrl, youtubeId])

  if (mode === 'loading') {
    return (
      <DemoChrome caption="Loading demo…">
        <div className="flex aspect-video items-center justify-center bg-slate-50 text-sm text-slate-400">Preparing demo player…</div>
      </DemoChrome>
    )
  }

  if (mode === 'youtube' && youtubeId) return <YouTubeDemoVideo videoId={youtubeId} />
  if (mode === 'file' && fileUrl) return <HostedDemoVideo src={fileUrl} />
  return <GuidedDemoTour />
}
