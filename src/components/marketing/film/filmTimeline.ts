export type FilmCamera = {
  scale: number
  originX: number
  originY: number
}

export type FilmScene =
  | { id: string; kind: 'intro'; durationMs: number; camera?: FilmCamera; narration?: string }
  | {
      id: string
      kind: 'live'
      durationMs: number
      path: string
      cameras: { atMs: number; camera: FilmCamera }[]
      narration?: string
    }
  | { id: string; kind: 'ai-practice'; durationMs: number; cameras: { atMs: number; camera: FilmCamera }[]; narration?: string }
  | { id: string; kind: 'matching'; durationMs: number; cameras: { atMs: number; camera: FilmCamera }[]; narration?: string }
  | { id: string; kind: 'dashboard'; durationMs: number; cameras: { atMs: number; camera: FilmCamera }[]; narration?: string }
  | { id: string; kind: 'outro'; durationMs: number; camera?: FilmCamera; narration?: string }

/** ~53s total — matches generated voiceover length for homepage MP4. */
export const PRODUCT_FILM_SCENES: FilmScene[] = [
  {
    id: 'intro',
    kind: 'intro',
    durationMs: 3000,
    camera: { scale: 1, originX: 50, originY: 50 },
    narration: 'JobRound dot A I helps you prepare, practice, and book live mock interviews with confidence.',
  },
  {
    id: 'home-hero',
    kind: 'live',
    durationMs: 7500,
    path: '/#home',
    narration:
      'Your marketing home highlights the full journey: start preparing, watch the demo, and sign in when you are ready.',
    cameras: [
      { atMs: 0, camera: { scale: 1, originX: 50, originY: 35 } },
      { atMs: 1200, camera: { scale: 1.18, originX: 52, originY: 28 } },
      { atMs: 5500, camera: { scale: 1.08, originX: 50, originY: 42 } },
      { atMs: 8500, camera: { scale: 1.22, originX: 48, originY: 55 } },
    ],
  },
  {
    id: 'home-demo',
    kind: 'live',
    durationMs: 5500,
    path: '/#demo',
    narration: 'The platform demo shows how AI practice, matching, booking, and feedback fit together.',
    cameras: [
      { atMs: 0, camera: { scale: 1.05, originX: 50, originY: 40 } },
      { atMs: 2000, camera: { scale: 1.2, originX: 50, originY: 48 } },
      { atMs: 6500, camera: { scale: 1.12, originX: 55, originY: 52 } },
    ],
  },
  {
    id: 'ai-round',
    kind: 'ai-practice',
    durationMs: 12000,
    narration:
      'In AI mock interviews you answer real prompts, get structured scores, and improve before your next hiring loop.',
    cameras: [
      { atMs: 0, camera: { scale: 1, originX: 50, originY: 45 } },
      { atMs: 2500, camera: { scale: 1.15, originX: 38, originY: 38 } },
      { atMs: 9000, camera: { scale: 1.22, originX: 62, originY: 55 } },
      { atMs: 14000, camera: { scale: 1.08, originX: 50, originY: 72 } },
    ],
  },
  {
    id: 'matching',
    kind: 'matching',
    durationMs: 9000,
    narration: 'Find interviewers ranked by skill overlap, compare profiles, and book a live video mock in minutes.',
    cameras: [
      { atMs: 0, camera: { scale: 1, originX: 50, originY: 30 } },
      { atMs: 3000, camera: { scale: 1.14, originX: 35, originY: 45 } },
      { atMs: 8000, camera: { scale: 1.18, originX: 68, originY: 50 } },
    ],
  },
  {
    id: 'how-it-works',
    kind: 'live',
    durationMs: 5500,
    path: '/candidate/how-it-works',
    narration: 'How it works walks candidates from first visit through practice, booking, and feedback.',
    cameras: [
      { atMs: 0, camera: { scale: 1, originX: 50, originY: 25 } },
      { atMs: 3500, camera: { scale: 1.12, originX: 50, originY: 55 } },
      { atMs: 7500, camera: { scale: 1.06, originX: 50, originY: 80 } },
    ],
  },
  {
    id: 'dashboard',
    kind: 'dashboard',
    durationMs: 7000,
    narration: 'After sign in, your dashboard surfaces upcoming mocks, practice scores, and clear next steps.',
    cameras: [
      { atMs: 0, camera: { scale: 1, originX: 50, originY: 22 } },
      { atMs: 4000, camera: { scale: 1.1, originX: 30, originY: 55 } },
      { atMs: 8500, camera: { scale: 1.08, originX: 70, originY: 60 } },
    ],
  },
  {
    id: 'outro',
    kind: 'outro',
    durationMs: 3500,
    camera: { scale: 1, originX: 50, originY: 50 },
    narration: 'Start preparing today at jobround dot A I.',
  },
]

export function filmNarrationScript(scenes: FilmScene[] = PRODUCT_FILM_SCENES) {
  return scenes.map((scene) => scene.narration).filter(Boolean).join(' ')
}

export function totalFilmDurationMs(scenes: FilmScene[] = PRODUCT_FILM_SCENES) {
  return scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
}

export function cameraAtTime(
  keyframes: { atMs: number; camera: FilmCamera }[],
  elapsedMs: number,
  fallback: FilmCamera,
): FilmCamera {
  let current = fallback
  for (const frame of keyframes) {
    if (frame.atMs <= elapsedMs) current = frame.camera
  }
  return current
}
