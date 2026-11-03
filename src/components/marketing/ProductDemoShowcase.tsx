import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Video,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { getDemoVideoUrl, getDemoYouTubeId, youtubeEmbedUrl } from '../../lib/demoMedia.ts'

const SCENE_MS = 4800

/** Human live booking leads; AI practice comes after matching and job prep. */
const scenes = [
  {
    id: 'book',
    label: 'Book a human round',
    title: 'Pick a time and confirm',
    body: 'Choose a service, select a slot, and join a live video mock with a real interviewer.',
    icon: Calendar,
    accent: 'bg-violet-100 text-violet-700 ring-violet-200',
    bar: 'from-violet-500 to-sky-400',
    cameras: [
      { scale: 1, originX: 48, originY: 42 },
      { scale: 1.16, originX: 62, originY: 55 },
      { scale: 1.08, originX: 40, originY: 48 },
    ],
  },
  {
    id: 'match',
    label: 'Interviewer matching',
    title: 'Ranked by skill overlap',
    body: 'See why each professional fits your stack before you book.',
    icon: BadgeCheck,
    accent: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    bar: 'from-emerald-500 to-mint-500',
    cameras: [
      { scale: 1.02, originX: 35, originY: 40 },
      { scale: 1.18, originX: 28, originY: 52 },
      { scale: 1.1, originX: 70, originY: 45 },
    ],
  },
  {
    id: 'job',
    label: 'Job-specific prep',
    title: 'Matched to your target role',
    body: 'Paste a job posting or pick skills — preparation follows the role you are targeting.',
    icon: Target,
    accent: 'bg-sky-100 text-sky-700 ring-sky-200',
    bar: 'from-sky-500 to-violet-400',
    cameras: [
      { scale: 1, originX: 50, originY: 35 },
      { scale: 1.2, originX: 55, originY: 60 },
      { scale: 1.08, originX: 45, originY: 40 },
    ],
  },
  {
    id: 'ai',
    label: 'AI mock interview',
    title: 'Practice between live rounds',
    body: 'Answer real interview questions and get scored feedback after each AI practice session.',
    icon: Sparkles,
    accent: 'bg-coral-100 text-coral-700 ring-coral-200',
    bar: 'from-coral-500 to-amber-400',
    cameras: [
      { scale: 1.04, originX: 42, originY: 38 },
      { scale: 1.22, originX: 58, originY: 55 },
      { scale: 1.1, originX: 50, originY: 48 },
    ],
  },
  {
    id: 'feedback',
    label: 'Performance feedback',
    title: 'Scorecard you can reuse',
    body: 'Structured scores and notes — not a vague “you did fine.”',
    icon: TrendingUp,
    accent: 'bg-amber-100 text-amber-800 ring-amber-200',
    bar: 'from-amber-500 to-rose-400',
    cameras: [
      { scale: 1, originX: 50, originY: 40 },
      { scale: 1.14, originX: 35, originY: 50 },
      { scale: 1.2, originX: 65, originY: 42 },
    ],
  },
] as const

const POSTER = '/demo/poster.svg'

type DemoMode = 'loading' | 'file' | 'youtube' | 'guided'
type Camera = { scale: number; originX: number; originY: number }

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
          <span className="ml-2 truncate text-xs font-medium text-slate-500">jobround.ai — product demo</span>
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

function SceneMock({ sceneId }: { sceneId: (typeof scenes)[number]['id'] }) {
  if (sceneId === 'book') {
    return (
      <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Available slots</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['Tue 4:00', 'Wed 11:30', 'Thu 6:00', 'Fri 9:00', 'Sat 2:00', 'Mon 5:30'].map((slot, i) => (
              <div
                key={slot}
                className={cn(
                  'rounded-xl border px-2 py-2 text-center text-[11px] font-semibold',
                  i === 1
                    ? 'border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-200'
                    : 'border-slate-200 bg-slate-50 text-slate-600',
                )}
              >
                {slot}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-sky-500 px-3 py-2.5 text-sm font-semibold text-white shadow-md">
            <Video className="h-4 w-4" aria-hidden />
            Confirm live booking
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-navy-950 to-[#1e3a6e] p-4 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-bold">AP</div>
            <div>
              <p className="text-sm font-semibold">Alex P. · Staff Eng</p>
              <p className="text-xs text-blue-200">45 min · live video</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs text-blue-100">
            <p className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-sky-300" aria-hidden />
              Wed 11:30 · your timezone
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
              System design · behavioral
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (sceneId === 'match') {
    return (
      <div className="space-y-2.5">
        {[
          { name: 'Priya N.', role: 'EM · Stripe alum', score: 94, skills: 'System design · Leadership' },
          { name: 'Marcus L.', role: 'Staff · Meta', score: 88, skills: 'Backend · Behavioral' },
          { name: 'Jin W.', role: 'Principal · Airbnb', score: 81, skills: 'Product sense · Specs' },
        ].map((row, i) => (
          <div
            key={row.name}
            className={cn(
              'flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm',
              i === 0 ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200',
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-xs font-bold text-white">
              {row.name
                .split(' ')
                .map((p) => p[0])
                .join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-950">{row.name}</p>
              <p className="truncate text-xs text-slate-500">
                {row.role} · {row.skills}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-600">{row.score}%</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">overlap</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (sceneId === 'job') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">Target role</p>
          <p className="mt-2 text-sm font-semibold text-navy-950">Senior Frontend Engineer</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">React · TypeScript · Design systems · Hiring loop prep</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['React', 'TypeScript', 'System design', 'Communication'].map((tag) => (
              <span key={tag} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Prep plan</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
              Live mock with role-matched interviewer
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
              AI drills on weak topics between rounds
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
              Scorecard tracked to this job target
            </li>
          </ul>
        </div>
      </div>
    )
  }

  if (sceneId === 'ai') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-coral-600">AI mock · Q2 of 5</p>
          <span className="rounded-full bg-coral-50 px-2 py-0.5 text-[11px] font-semibold text-coral-700">02:14</span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-navy-950">
          Walk me through how you would design a real-time interview feedback board.
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-coral-500 to-amber-400 demo-progress-pulse" />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-coral-500" aria-hidden />
          Listening… structured scoring after you finish
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: 'Clarity', score: 4.5 },
        { label: 'Depth', score: 4.0 },
        { label: 'Structure', score: 4.8 },
      ].map((item) => (
        <div key={item.label} className="rounded-2xl border border-amber-200/80 bg-white p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">{item.label}</p>
          <p className="mt-2 text-2xl font-bold text-navy-950">{item.score}</p>
          <div className="mt-2 flex justify-center gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn('h-3.5 w-3.5', i < Math.round(item.score) ? 'fill-current' : 'opacity-25')} aria-hidden />
            ))}
          </div>
        </div>
      ))}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-amber-50 to-rose-50 p-4 sm:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Coach note</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Strong opening — tighten trade-offs before diving into implementation next round.
        </p>
      </div>
    </div>
  )
}

function GuidedDemoTour() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [cameraIndex, setCameraIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const scene = scenes[index]
  const Icon = scene.icon
  const camera: Camera = scene.cameras[Math.min(cameraIndex, scene.cameras.length - 1)]

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const node = rootRef.current
    if (!node || reducedMotion) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setPlaying(true)
      },
      { threshold: 0.45 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion])

  useEffect(() => {
    if (!playing || reducedMotion) return
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % scenes.length)
      setCameraIndex(0)
    }, SCENE_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index, reducedMotion])

  useEffect(() => {
    if (!playing || reducedMotion) return
    const step = Math.max(1200, Math.floor(SCENE_MS / scene.cameras.length))
    const timer = window.setInterval(() => {
      setCameraIndex((current) => (current + 1) % scene.cameras.length)
    }, step)
    return () => window.clearInterval(timer)
  }, [playing, index, reducedMotion, scene.cameras.length])

  return (
    <DemoChrome caption="Auto-playing product demo with zoom — live human booking first, then matching, prep, AI practice, and feedback.">
      <div ref={rootRef} className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#0b1220] via-[#152447] to-[#3b1d6e] sm:aspect-video">
        <div
          className="demo-camera absolute inset-0 will-change-transform"
          style={{
            transform: `scale(${reducedMotion ? 1 : camera.scale})`,
            transformOrigin: `${camera.originX}% ${camera.originY}%`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.25),transparent_45%)]" />
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.65)] backdrop-blur-sm lg:grid-cols-[12.5rem_minmax(0,1fr)]">
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
                        onClick={() => {
                          setIndex(i)
                          setCameraIndex(0)
                          setPlaying(false)
                        }}
                        aria-current={active ? 'step' : undefined}
                      >
                        <ItemIcon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-violet-600' : 'text-sky-300')} aria-hidden />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </aside>

              <div className="flex min-h-[18rem] flex-col bg-gradient-to-br from-white via-slate-50 to-violet-50/40 px-5 py-5 sm:min-h-[20rem] sm:px-7 sm:py-6">
                <span
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                    scene.accent,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {scene.label}
                </span>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-navy-950 sm:text-2xl">{scene.title}</h3>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">{scene.body}</p>
                <div key={scene.id} className="demo-scene-enter mt-4 flex-1">
                  <SceneMock sceneId={scene.id} />
                </div>
                <div className="mt-4">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', scene.bar)}
                      style={{ width: `${((index + 1) / scenes.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Step {index + 1} of {scenes.length}
                    {playing ? ' · playing' : ' · paused'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 sm:bottom-4 sm:left-4 sm:right-4">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-semibold text-navy-950 shadow-lg backdrop-blur hover:bg-white"
            onClick={() => setPlaying((value) => !value)}
            aria-pressed={playing}
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
            {playing ? 'Pause demo' : 'Play demo'}
          </button>
          <div className="hidden items-center gap-1.5 sm:flex">
            {scenes.map((item, i) => (
              <span
                key={item.id}
                className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40')}
                aria-hidden
              />
            ))}
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
