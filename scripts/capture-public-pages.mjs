#!/usr/bin/env node
/**
 * Capture the public signed-out pages (marketing Home, legal, safety) at real
 * widths in light and dark, using the local dev server.
 *
 * Usage:
 *   pnpm dev:web                      # or the vite dev command on :3000
 *   node scripts/capture-public-pages.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.PUBLIC_BASE ?? 'http://localhost:3000'
const OUT = '.playwright-mcp/review'

const PAGES = [
  ['/', 'public-home', 1440, 'light', 'Make a friend'],
  ['/', 'public-home-dark', 1440, 'dark', 'Make a friend'],
  ['/', 'public-home-320', 320, 'light', ''],
  ['/', 'public-home-390', 390, 'light', ''],
  ['/', 'public-home-390-dark', 390, 'dark', ''],
  ['/privacy-policy', 'public-privacy-320', 320, 'light', ''],
  ['/privacy-policy', 'public-privacy-390', 390, 'light', ''],
  ['/privacy-policy', 'public-privacy-390-dark', 390, 'dark', ''],
  ['/privacy-policy', 'public-privacy-1440', 1440, 'light', ''],
  ['/terms-and-conditions', 'public-terms-320', 320, 'light', ''],
  ['/terms-and-conditions', 'public-terms-390', 390, 'light', ''],
  ['/terms-and-conditions', 'public-terms-390-dark', 390, 'dark', ''],
  ['/terms-and-conditions', 'public-terms-1440', 1440, 'light', ''],
  ['/safety', 'public-safety-320', 320, 'light', ''],
  ['/safety', 'public-safety-390', 390, 'light', ''],
  ['/safety', 'public-safety-390-dark', 390, 'dark', ''],
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const failures = []

for (const [path, name, width, theme, landmark] of PAGES) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } })
  await context.addInitScript((value) => {
    localStorage.setItem('lets-be-friends-theme', value)
  }, theme)
  const page = await context.newPage()
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 30000 })
    if (!response || !response.ok()) throw new Error(`status ${response ? response.status() : 'none'}`)
    await page.waitForTimeout(1200)
    // Trigger lazy-loaded marketing imagery before the full-page capture.
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.8)
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(800)
    const state = await page.evaluate((mark) => {
      const text = document.body.innerText || ''
      return {
        textLength: text.trim().length,
        hasLandmark: mark ? text.includes(mark) : true,
        error: /Something went wrong|Cannot read properties|is not defined/i.test(text),
        theme: document.documentElement.dataset.theme,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    }, landmark)
    if (state.error) throw new Error('rendered an error boundary')
    if (state.textLength < 200) throw new Error(`blank body (${state.textLength} chars)`)
    if (!state.hasLandmark) throw new Error(`landmark "${landmark}" missing`)
    if (state.theme !== theme) throw new Error(`theme ${state.theme}, expected ${theme}`)
    if (state.overflow > 0) throw new Error(`horizontal overflow +${state.overflow}px`)
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, scale: 'css' })
  } catch (error) {
    failures.push(`${path} @${width} ${theme}: ${String(error).slice(0, 160)}`)
  } finally {
    await context.close()
  }
}

await browser.close()

if (failures.length) {
  console.error('Public capture failures:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Captured ${PAGES.length} public pages into ${OUT}/`)
