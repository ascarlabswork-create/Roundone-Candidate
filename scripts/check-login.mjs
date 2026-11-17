import { chromium } from 'playwright'

const base = process.env.CHECK_URL ?? 'https://roundone-candidate-plum.vercel.app'
const path = process.env.CHECK_PATH ?? '/candidate/login?next=%2F'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console:${message.text()}`)
})
let status = 0
try {
  const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  status = response?.status() ?? 0
} catch (caught) {
  errors.push(`goto:${caught instanceof Error ? caught.message : String(caught)}`)
}
await page.waitForTimeout(2500)
const bodyPreview = await page.locator('body').innerText().catch(() => '')
const hasLogin = await page.getByRole('heading', { name: /sign in/i }).count()
console.log(JSON.stringify({ base, path, status, hasLogin, bodyPreview: bodyPreview.slice(0, 400), errors }, null, 2))
await browser.close()
