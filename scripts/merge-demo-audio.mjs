import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const DEMO_NARRATION =
  'JobRound dot A I helps you prepare, practice, and book live mock interviews with confidence. Your marketing home highlights the full journey: start preparing, watch the demo, and sign in when you are ready. The platform demo leads with live human booking, then matching, AI practice, and feedback. Find interviewers ranked by skill overlap, compare profiles, and book a live video mock in minutes. How it works walks candidates from matching and booking a human round through feedback. Between live bookings, AI mock interviews help you answer real prompts, get scored feedback, and improve before the next hiring loop. After sign in, your dashboard surfaces upcoming live mocks, practice scores, and clear next steps. Start preparing today at jobround dot A I.'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const webm = path.join(root, 'public', 'demo', 'product-demo.webm')
const wav = path.join(root, 'public', 'demo', 'narration.wav')
const mp4 = path.join(root, 'public', 'demo', 'product-demo.mp4')

function findFfmpeg() {
  if (ffmpegInstaller?.path && fs.existsSync(ffmpegInstaller.path)) return ffmpegInstaller.path
  const fromPath = spawnSync('where', ['ffmpeg'], { encoding: 'utf8', shell: true })
  if (fromPath.status === 0) {
    const line = fromPath.stdout.trim().split(/\r?\n/)[0]
    if (line) return line
  }
  return null
}

function buildNarrationWav() {
  if (process.platform !== 'win32') {
    console.warn('Narration WAV generation is supported on Windows (System.Speech). Add public/demo/narration.wav manually on other OS.')
    return fs.existsSync(wav)
  }
  const text = DEMO_NARRATION.replace(/'/g, "''")
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.SetOutputToWaveFile('${wav.replace(/\\/g, '\\\\')}')
$s.Speak('${text}')
$s.Dispose()
`
  const result = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
  return result.status === 0 && fs.existsSync(wav)
}

if (!fs.existsSync(webm)) {
  console.error('Missing public/demo/product-demo.webm — run npm run record:demo first.')
  process.exit(1)
}

if (!fs.existsSync(wav) && !buildNarrationWav()) {
  console.error('Could not build narration.wav')
  process.exit(1)
}

const ffmpeg = findFfmpeg()
if (!ffmpeg) {
  console.error('ffmpeg not found. Install ffmpeg or run: npx playwright install chromium')
  process.exit(1)
}

const merge = spawnSync(
  ffmpeg,
  [
    '-y',
    '-i',
    webm,
    '-i',
    wav,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'medium',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    mp4,
  ],
  { stdio: 'inherit' },
)

if (merge.status !== 0) process.exit(merge.status ?? 1)
console.log(`Saved ${mp4} with voiceover.`)
