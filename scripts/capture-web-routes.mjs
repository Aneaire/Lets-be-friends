#!/usr/bin/env node
/**
 * Sign in to the local web app with a Clerk sign-in ticket and audit every web
 * route at desktop and phone widths.
 *
 * Usage:
 *   node scripts/capture-web-routes.mjs             # report
 *   node scripts/capture-web-routes.mjs --check     # exit non-zero on failures
 *   node scripts/capture-web-routes.mjs --probe     # sign in and list links
 *
 * Requires the dev server on :3000 and CLERK_SECRET_KEY in the root .env.local.
 * The Clerk user must have completed onboarding once.
 */
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { MEASURE } from './lib/design-measure.mjs'

const BASE = process.env.WEB_BASE ?? 'http://localhost:3000'
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light'
const OUT = `.playwright-mcp/review/web-routes${THEME === 'dark' ? '-dark' : ''}`
const WIDTHS = [1440, 1280, 1024, 768, 640, 480, 414, 390, 375, 360, 320]
const CAPTURE_WIDTHS = new Set([1440, 390, 320])
const USER_ID = process.env.CLERK_USER_ID ?? 'user_3Lmh1qN46xEB1p7P1bc7Tf6823q'

const STATIC_ROUTES = [
  ['/', 'home'],
  ['/social', 'social'],
  ['/nearby', 'nearby'],
  ['/app', 'bookings'],
  ['/circles', 'circles'],
  ['/discover', 'discover'],
  ['/settings', 'settings'],
  ['/profile', 'profile'],
  ['/companion', 'companion'],
  ['/become-companion', 'become-companion'],
  ['/companion-profile', 'companion-profile-empty'],
  ['/member-profile', 'member-profile-empty'],
  ['/review', 'review-empty'],
  ['/referrals', 'referrals'],
  ['/notifications', 'notifications'],
  ['/messages', 'messages'],
  ['/transactions', 'transactions'],
  ['/wallet', 'wallet'],
  ['/get-verified', 'get-verified'],
  ['/verify-identity', 'verify-identity'],
  ['/verified', 'verified'],
  ['/onboarding', 'onboarding'],
  ['/safety', 'safety'],
  ['/privacy-policy', 'privacy'],
  ['/terms-and-conditions', 'terms'],
]

function envValue(text, key) {
  const line = text.split('\n').find((entry) => entry.startsWith(`${key}=`))
  if (!line) return undefined
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
}

async function createTicket() {
  const env = await readFile('.env.local', 'utf8')
  const secret = envValue(env, 'CLERK_SECRET_KEY')
  if (!secret) throw new Error('CLERK_SECRET_KEY missing from .env.local')
  const response = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: USER_ID, expires_in_seconds: 600 }),
  })
  if (!response.ok) throw new Error(`Clerk sign-in token failed: ${response.status} ${await response.text()}`)
  return (await response.json()).token
}

async function signIn(page) {
  const ticket = await createTicket()
  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 })
  await page.waitForFunction(() => Boolean(window.Clerk?.loaded), null, { timeout: 30000 })
  const result = await page.evaluate(async (value) => {
    const clerk = window.Clerk
    if (!clerk) return { error: 'no Clerk instance' }
    if (clerk.session) return { already: true, userId: clerk.user?.id }
    try {
      const attempt = await clerk.client.signIn.create({ strategy: 'ticket', ticket: value })
      if (attempt.status !== 'complete' || !attempt.createdSessionId) return { status: attempt.status }
      await clerk.setActive({ session: attempt.createdSessionId })
      return { userId: clerk.user?.id }
    } catch (error) {
      return { error: String(error?.message ?? error).slice(0, 300) }
    }
  }, ticket)
  if (result.error || result.status) throw new Error(`Sign-in failed: ${JSON.stringify(result)}`)
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 20000 })
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(2500)
  return result
}

async function discoverIds(page) {
  const ids = { circle: undefined, companion: undefined, member: undefined }
  await page.goto(`${BASE}/circles`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !document.body.innerText.includes('Getting things ready'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const circle = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a[href^="/circles/"]')].find((a) => a.getAttribute('href').split('/')[2]?.length > 10)
    return link?.getAttribute('href')
  })
  if (circle) ids.circle = circle
  await page.goto(`${BASE}/social`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !document.body.innerText.includes('Getting things ready'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1800)
  const feed = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    return {
      companion: links.find((href) => href?.startsWith('/companion-profile?companionProfileId=')),
      member: links.find((href) => href?.startsWith('/member-profile?userId=')),
    }
  })
  ids.member = feed.member

  // Prefer a Companion from the directory: those profiles carry strengths,
  // categories, and copy, unlike a bare feed link.
  await page.goto(`${BASE}/discover`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !document.body.innerText.includes('Getting things ready'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1600)
  const directory = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
    .map((a) => a.getAttribute('href'))
    .find((href) => href?.startsWith('/companion-profile?companionProfileId=')))
  ids.companion = directory ?? feed.companion

  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !document.body.innerText.includes('Getting things ready'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1400)
  const bookings = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    return {
      booking: links.find((href) => href?.startsWith('/app?bookingId=')),
      review: links.find((href) => href?.startsWith('/review?reviewId=')),
    }
  })
  ids.booking = bookings.booking
  ids.review = bookings.review

  await page.goto(`${BASE}/messages`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !document.body.innerText.includes('Getting things ready'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const thread = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).find((href) => href?.startsWith('/messages?conversationId=')))
  ids.thread = thread
  return ids
}

const probe = process.argv.includes('--probe')
const check = process.argv.includes('--check')
await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ['geolocation'],
  geolocation: { latitude: 15.03, longitude: 120.69 },
})
await context.addInitScript((theme) => {
  localStorage.setItem('lets-be-friends-theme', theme)
}, THEME)
const page = await context.newPage()
const session = await signIn(page)
console.log('signed in as', session.userId ?? session.already)

if (probe) {
  const ids = await discoverIds(page)
  console.log('discovered', ids)
  await browser.close()
  process.exit(0)
}

const ids = await discoverIds(page)
console.log('discovered', ids)

const routes = [...STATIC_ROUTES]
if (ids.circle) routes.push([ids.circle, 'circles-detail'])
if (ids.companion) routes.push([`/companion-profile?companionProfileId=${ids.companion.split('=')[1]}`, 'companion-profile'])
if (ids.member) routes.push([`/member-profile?userId=${ids.member.split('=')[1]}`, 'member-profile'])
if (ids.booking) routes.push([ids.booking, 'booking-detail'])
if (ids.review) routes.push([ids.review, 'review'])
if (ids.thread) routes.push([ids.thread, 'message-thread'])

const results = []
let failures = 0

for (const [path, slug] of routes) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 500 ? 900 : 1000 })
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      // Wait out the onboarding gate; every authenticated route renders a
      // "Getting things ready" shell while Convex reconnects after a reload.
      await page.waitForFunction(
        () => !document.body.innerText.includes('Getting things ready'),
        null,
        { timeout: 20000 },
      ).catch(() => {})
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(width >= 1024 ? 900 : 600)
      const finalUrl = new URL(page.url())
      const data = await page.evaluate(MEASURE)
      const appliedTheme = await page.evaluate(() => document.documentElement.dataset.theme)
      if (appliedTheme !== THEME) throw new Error(`theme ${appliedTheme}, expected ${THEME}`)
      const redirected = finalUrl.pathname !== new URL(`${BASE}${path}`).pathname
      const h1Bad = (data.h1Sizes || []).filter((size) => size < 28 || size > 40)
      const pass = data.minFont >= 13 && data.overflowX <= 0 && data.unexpectedTargets.length === 0 &&
        h1Bad.length === 0 && data.contrastFailures.length === 0 && data.unverifiedContrast.length === 0 &&
        data.h1Count > 0
      if (!pass) failures += 1
      results.push({ path, slug, width, finalUrl: finalUrl.pathname + finalUrl.search, redirected, pass, ...data })
      if (CAPTURE_WIDTHS.has(width)) {
        await page.screenshot({ path: `${OUT}/${slug}-${width}.png`, fullPage: true, scale: 'css' })
      }
      const flags = [
        data.minFont < 13 ? `LOW:${data.minFont}` : '',
        data.overflowX > 0 ? `OVERFLOW:+${data.overflowX}` : '',
        data.unexpectedTargets.length ? `TARGETS:${data.unexpectedTargets.length}` : '',
        data.contrastFailures.length ? `CONTRAST:${data.contrastFailures.length}` : '',
        data.unverifiedContrast.length ? `UNVERIFIED:${data.unverifiedContrast.length}` : '',
        h1Bad.length ? `H1:${h1Bad.join(',')}` : '',
        data.h1Count === 0 ? 'NO-H1' : '',
        redirected ? `REDIRECT:${finalUrl.pathname}` : '',
      ].filter(Boolean).join(' ')
      console.log(`${pass ? 'OK  ' : 'FAIL'} ${String(width).padStart(4)} ${slug.padEnd(26)} h1=${(data.h1Sizes || []).join(',')} ${flags}`)
    } catch (error) {
      failures += 1
      console.log(`ERROR ${String(width).padStart(3)} ${slug}: ${String(error).slice(0, 160)}`)
    }
  }
}

await writeFile(`${OUT}/results.json`, JSON.stringify(results, null, 2))
await browser.close()

console.log(`\n${results.length - failures}/${results.length} route renders pass. Results: ${OUT}/results.json`)
process.exit(check && failures ? 1 : 0)
