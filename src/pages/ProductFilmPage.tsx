import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FilmViewport } from '../components/marketing/film/FilmViewport.tsx'
import {
  cameraAtTime,
  PRODUCT_FILM_SCENES,
  totalFilmDurationMs,
  type FilmCamera,
  type FilmScene,
} from '../components/marketing/film/filmTimeline.ts'
import { AiPracticeFilmScene } from '../components/marketing/film/scenes/AiPracticeFilmScene.tsx'
import { DashboardFilmScene } from '../components/marketing/film/scenes/DashboardFilmScene.tsx'
import { LivePageScene } from '../components/marketing/film/scenes/LivePageScene.tsx'
import { MatchingFilmScene } from '../components/marketing/film/scenes/MatchingFilmScene.tsx'
import { Logo } from '../components/layout/Logo.tsx'
import { useDemoNarration } from '../components/marketing/useDemoNarration.ts'

const DEFAULT_CAMERA: FilmCamera = { scale: 1, originX: 50, originY: 50 }

function IntroScene() {
  return (
    <div className="flex h-full min-h-[720px] flex-col items-center justify-center bg-gradient-to-br from-[#101c35] via-[#1d4ed8] to-[#7c3aed] px-6 text-center text-white">
      <Logo inverted />
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.28em] text-sky-200">Product film</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
        Prepare, practice, and book live mocks — on JobRound.ai
      </h1>
      <p className="mt-4 max-w-xl text-lg text-blue-100">AI practice, expert matching, and live mock interviews</p>
    </div>
  )
}

function OutroScene() {
  return (
    <div className="flex h-full min-h-[720px] flex-col items-center justify-center bg-gradient-to-br from-[#7c3aed] via-[#007aff] to-[#101c35] px-6 text-center text-white">
      <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Start preparing today</h2>
      <p className="mt-4 text-xl text-blue-100">jobround.ai</p>
      <p className="mt-8 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-medium">AI mock interviews · Expert matchers · Live video feedback</p>
    </div>
  )
}

function sceneCamera(scene: FilmScene, elapsedInSceneMs: number): FilmCamera {
  if (scene.kind === 'intro' || scene.kind === 'outro') {
    return scene.camera ?? DEFAULT_CAMERA
  }
  if (scene.kind === 'live' || scene.kind === 'ai-practice' || scene.kind === 'matching' || scene.kind === 'dashboard') {
    return cameraAtTime(scene.cameras, elapsedInSceneMs, DEFAULT_CAMERA)
  }
  return DEFAULT_CAMERA
}

function SceneBody({ scene, baseOrigin }: { scene: FilmScene; baseOrigin: string }) {
  if (scene.kind === 'intro') return <IntroScene />
  if (scene.kind === 'outro') return <OutroScene />
  if (scene.kind === 'live') return <LivePageScene path={scene.path} baseOrigin={baseOrigin} />
  if (scene.kind === 'ai-practice') return <AiPracticeFilmScene />
  if (scene.kind === 'matching') return <MatchingFilmScene />
  if (scene.kind === 'dashboard') return <DashboardFilmScene />
  return null
}

export function ProductFilmPage() {
  const [params] = useSearchParams()
  const autoplay = params.get('autoplay') === '1'
  const showChrome = params.get('chrome') !== '0'
  const narrate = params.get('narrate') !== '0'
  const { speak, cancel } = useDemoNarration()
  const [playing, setPlaying] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [elapsedInScene, setElapsedInScene] = useState(0)
  const [finished, setFinished] = useState(false)

  const scenes = PRODUCT_FILM_SCENES
  const scene = scenes[sceneIndex]
  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  const camera = useMemo(() => sceneCamera(scene, elapsedInScene), [scene, elapsedInScene])

  useEffect(() => {
    if (!playing || !narrate || finished) return
    cancel()
    const line = scene.narration
    if (line) speak(line)
    return () => cancel()
  }, [scene.id, scene.narration, playing, narrate, finished, speak, cancel])

  useEffect(() => {
    if (!autoplay) return
    const start = window.setTimeout(() => {
      setSceneIndex(0)
      setElapsedInScene(0)
      setFinished(false)
      setPlaying(true)
    }, 900)
    return () => window.clearTimeout(start)
  }, [autoplay])

  useEffect(() => {
    if (!playing || finished) return
    const tick = window.setInterval(() => {
      setElapsedInScene((ms) => ms + 100)
    }, 100)
    return () => window.clearInterval(tick)
  }, [playing, finished])

  useEffect(() => {
    if (!playing || finished) return
    if (elapsedInScene < scene.durationMs) return
    if (sceneIndex >= scenes.length - 1) {
      setFinished(true)
      setPlaying(false)
      ;(window as Window & { __DEMO_FILM_DONE__?: boolean }).__DEMO_FILM_DONE__ = true
      window.dispatchEvent(new CustomEvent('jobround-demo-film-complete'))
      return
    }
    setSceneIndex((i) => i + 1)
    setElapsedInScene(0)
  }, [elapsedInScene, scene.durationMs, sceneIndex, scenes.length, playing, finished])

  const totalMs = totalFilmDurationMs(scenes)
  const progress =
    scenes.slice(0, sceneIndex).reduce((s, item) => s + item.durationMs, 0) + Math.min(elapsedInScene, scene.durationMs)

  useEffect(() => {
    if (!playing || finished || progress < totalMs) return
    setFinished(true)
    setPlaying(false)
    ;(window as Window & { __DEMO_FILM_DONE__?: boolean }).__DEMO_FILM_DONE__ = true
    window.dispatchEvent(new CustomEvent('jobround-demo-film-complete'))
  }, [progress, totalMs, playing, finished])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black text-white">
      <div className="relative mx-auto aspect-video w-full max-h-svh max-w-[1920px] flex-1">
        <FilmViewport camera={camera}>
          <SceneBody key={scene.id} scene={scene} baseOrigin={baseOrigin} />
        </FilmViewport>
        {!playing && !finished ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <p className="text-lg font-semibold">JobRound.ai product film</p>
            <p className="mt-2 max-w-md text-center text-sm text-slate-300">
              ~{Math.round(totalMs / 1000)}s · Real site pages + AI practice UI · Ken Burns zoom
            </p>
            <button
              type="button"
              className="mt-6 rounded-xl bg-gradient-to-r from-coral-600 to-violet-600 px-6 py-3 text-sm font-semibold shadow-lg"
              onClick={() => {
                setSceneIndex(0)
                setElapsedInScene(0)
                setFinished(false)
                setPlaying(true)
              }}
            >
              {autoplay ? 'Start film (autoplay)' : 'Play film for recording'}
            </button>
            <p className="mt-4 text-xs text-slate-500">Record with OBS, or run npm run record:demo</p>
          </div>
        ) : null}
      </div>
      {showChrome ? (
        <div className="flex items-center gap-3 border-t border-white/10 bg-[#0a0f1a] px-4 py-2 text-xs text-slate-400">
          <span className="font-mono">{scene.id}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-coral-500 to-violet-500" style={{ width: `${(progress / totalMs) * 100}%` }} />
          </div>
          <span>{Math.ceil((totalMs - progress) / 1000)}s left</span>
        </div>
      ) : null}
    </div>
  )
}
