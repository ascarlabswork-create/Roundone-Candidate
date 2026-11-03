/**
 * Records public/demo/product-demo.webm (and .mp4 if ffmpeg is installed)
 * from the cinematic /product-film page.
 *
 * Usage:
 *   Terminal 1: npm run dev
 *   Terminal 2: npm run record:demo
 *
 * Env:
 *   DEMO_BASE_URL=http://127.0.0.1:5173   (default)
 *   DEMO_FILM_BUFFER_MS=2000              extra tail after film completes
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const baseUrl = (process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const bufferMs = Number(process.env.DEMO_FILM_BUFFER_MS ?? 2500)
const tmpDir = path.join(root, 'tmp', 'demo-record')
const outDir = path.join(root, 'public', 'demo')

fs.mkdirSync(tmpDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

const health = await fetch(`${baseUrl}/`).catch(() => null)
if (!health?.ok) {
  console.error(`Could not reach ${baseUrl}. Start the app first (npm run dev).`)
  process.exit(1)
}

console.log(`Recording product film from ${baseUrl}/product-film?autoplay=1 …`)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: tmpDir, size: { width: 1920, height: 1080 } },
  deviceScaleFactor: 1,
})
const page = await context.newPage()

await page.goto(`${baseUrl}/product-film?autoplay=1&chrome=0&narrate=0`, { waitUntil: 'networkidle', timeout: 120_000 })

await page.waitForFunction(() => window.__DEMO_FILM_DONE__ === true, { timeout: 130_000 }).catch(async () => {
  console.warn('Film did not signal completion — waiting 95s fallback.')
  await page.waitForTimeout(95_000)
})

await page.waitForTimeout(bufferMs)

const video = page.video()
await context.close()
await browser.close()

if (!video) {
  console.error('No Playwright video artifact.')
  process.exit(1)
}

const webmPath = await video.path()
const destWebm = path.join(outDir, 'product-demo.webm')
fs.copyFileSync(webmPath, destWebm)
console.log(`Saved ${destWebm}`)

const destMp4 = path.join(outDir, 'product-demo.mp4')
console.log('Tip: run npm run record:demo:audio to add voiceover and export product-demo.mp4.')
