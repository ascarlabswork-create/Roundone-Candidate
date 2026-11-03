import { BadgeCheck, Calendar, MessageSquare, Pause, Play, Sparkles, Target, TrendingUp, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { getDemoVideoUrl, getDemoYouTubeId, youtubeEmbedUrl } from '../../lib/demoMedia.ts'
import { useDemoNarration } from './useDemoNarration.ts'

const scenes = [
  {
    id: 'book',
    label: 'Book a human round',
    title: 'Pick a time and confirm',
    body: 'Choose a service, select a slot, and join a live video mock with a real interviewer.',
    narration:
      'Start with a live human mock. Match with a working professional, pick a service and time, then join a real video interview from your browser.',
    icon: Calendar,
    accent: 'bg-violet-50 text-violet-700',
  },
  {
    id: 'match',
    label: 'Interviewer matching',
    title: 'Ranked by skill overlap',
    body: 'See why each professional fits your stack before you book.',
    narration:
      'Browse interviewers ranked by overlap with your stack. Each profile explains why they are a strong fit before you book.',
    icon: BadgeCheck,
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'job',
    label: 'Job-specific prep',
    title: 'Matched to your target role',
    body: 'Paste a job posting or pick skills — preparation follows the role you are targeting.',
    narration:
      'Add a target job or résumé. JobRound tailors practice and prep to the role and skills you care about, not generic flashcards.',
    icon: Target,
    accent: 'bg-sky-50 text-sky-700',
  },
  {
    id: 'ai',
    label: 'AI mock interview',
    title: 'Practice between live rounds',
    body: 'Answer real interview questions and get scored feedback after each AI practice session.',
    narration:
      'Between live bookings, use AI mock interviews. Answer real prompts, get scored feedback, and sharpen your answers before the next human round.',
    icon: Sparkles,
    accent: 'bg-coral-50 text-coral-700',
  },
  {
    id: 'feedback',
    label: 'Performance feedback',
    title: 'Scorecard you can reuse',
    body: 'Structured scores and notes — not a vague “you did fine.”',
    narration:
      'After each session, review structured scores and notes on a scorecard you can revisit as you improve.',
    icon: TrendingUp,
    accent: 'bg-amber-50 text-amber-800',
  },
] as const

const POSTER = '/demo/poster.svg'

type DemoMode = 'loading' | 'file' | 'youtube' | 'guided'

function DemoChrome({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-gradient-to-r from-coral-400/30 via-violet-400/30 to-sky-400/30 blur-2xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-[#0a0f1a] shadow-[0_24px_60px_-32px_rgba(79,70,229,0.35)]">
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#141c2e] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
          <span className="ml-2 truncate text-xs font-medium text-slate-400">jobround.ai — product demo</span>
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

function GuidedDemoWithAudio() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const { speak, cancel, supported } = useDemoNarration()
  const advanceRef = useRef<number | null>(null)
  const scene = scenes[index]
  const Icon = scene.icon

  const clearAdvance = useCallback(() => {
    if (advanceRef.current != null) {
      window.clearTimeout(advanceRef.current)
      advanceRef.current = null
    }
  }, [])

  const goNext = useCallback(() => {
    setIndex((current) => (current + 1) % scenes.length)
  }, [])

  const playScene = useCallback(
    (sceneIndex: number) => {
      clearAdvance()
      cancel()
      const item = scenes[sceneIndex]
      if (!playing) return
      if (muted || !supported) {
        advanceRef.current = window.setTimeout(goNext, reducedMotion ? 8000 : 5500)
        return
      }
      speak(item.narration, () => {
        if (playing) goNext()
      })
    },
    [cancel, clearAdvance, goNext, muted, playing, reducedMotion, speak, supported],
  )

  useEffect(() => {
    playScene(index)
    return () => {
      clearAdvance()
      cancel()
    }
  }, [index, playScene, clearAdvance, cancel])

  useEffect(() => {
    if (!playing) {
      clearAdvance()
      cancel()
    } else {
      playScene(index)
    }
  }, [playing, muted, playScene, index, clearAdvance, cancel])

  const togglePlay = () => setPlaying((value) => !value)

  return (
    <DemoChrome caption="Voice-guided product demo with on-screen captions — the same candidate flows you use after sign-in.">
      <div className="aspect-video w-full bg-gradient-to-br from-[#101c35] via-[#1e3a8a] to-[#4c1d95]">
        <div className="flex h-full flex-col">
          <div className="flex flex-1 flex-col justify-center px-5 py-4 sm:px-8">
            <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', scene.accent)}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {scene.label}
            </span>
            <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl">{scene.title}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">{scene.body}</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-navy-950">
                  JR
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">Candidate workspace</p>
                  <p className="text-xs text-blue-200/80">Step {index + 1} of {scenes.length}</p>
                </div>
                <MessageSquare className="h-5 w-5 text-sky-300" aria-hidden />
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-coral-500 to-violet-400 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${((index + 1) / scenes.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/40 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-navy-950 hover:bg-blue-50"
                onClick={togglePlay}
                aria-pressed={playing}
              >
                {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
                {playing ? 'Pause' : 'Play demo with audio'}
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10"
                onClick={() => setMuted((value) => !value)}
                aria-pressed={muted}
                aria-label={muted ? 'Unmute voiceover' : 'Mute voiceover'}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <div className="hidden flex-wrap gap-1.5 sm:flex">
                {scenes.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      'rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                      i === index ? 'bg-white/20 text-white' : 'text-blue-200/80 hover:bg-white/10',
                    )}
                    onClick={() => {
                      setIndex(i)
                      if (!playing) setPlaying(true)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm leading-snug text-blue-100/90" aria-live="polite">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">Captions · </span>
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
  const [mode, setMode] = useState<DemoMode>(() => (youtubeId ? 'youtube' : 'loading'))

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
        <div className="flex aspect-video items-center justify-center bg-[#141c2e] text-sm text-slate-400">Preparing demo player…</div>
      </DemoChrome>
    )
  }

  if (mode === 'youtube' && youtubeId) return <YouTubeDemoVideo videoId={youtubeId} />
  if (mode === 'file' && fileUrl) return <HostedDemoVideo src={fileUrl} />
  return <GuidedDemoWithAudio />
}
