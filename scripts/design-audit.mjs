#!/usr/bin/env node
/**
 * Design audit: renders the Storybook builds at real CSS widths and reports
 * computed readability, overflow, touch-target, and contrast measurements.
 *
 * Usage:
 *   node scripts/design-audit.mjs           # human summary, non-zero on failure
 *   node scripts/design-audit.mjs --json    # machine output
 *
 * Requires the two static builds to be served:
 *   pnpm build-storybook && pnpm build-storybook:mobile
 *   python3 -m http.server 6006 -d storybook-static
 *   python3 -m http.server 6007 -d storybook-static-mobile
 */
import { chromium } from 'playwright'

const WEB = 'http://localhost:6006'
const MOBILE = 'http://localhost:6007'
const PUBLIC = process.env.PUBLIC_BASE ?? 'http://localhost:3000'

const STORIES = [
  ['web', 'web-organisms-home-imagery--home-desktop-light', 1440],
  ['web', 'web-organisms-home-imagery--home-desktop-dark', 1440],
  ['web', 'web-organisms-home-imagery--home-320-light', 320],
  ['web', 'web-organisms-home-imagery--home-390-dark', 390],
  ['web', 'web-templates-app-shell-chrome--desktop-header', 1440],
  ['web', 'web-templates-app-shell-chrome--mobile-header-dark', 390],
  ['web', 'web-templates-workspace-shell--bookings-with-status', 1440],
  ['web', 'web-templates-workspace-shell--mobile-navigation-320', 320],
  ['web', 'web-templates-workspace-shell--dark', 1440],
  ['web', 'web-templates-workspace-shell--actions-and-toolbar', 768],
  ['web', 'web-templates-workspace-shell--actions-and-toolbar', 1024],
  ['web', 'web-organisms-social-compositions--profile-desktop', 768],
  ['web', 'web-organisms-social-compositions--profile-desktop', 1024],
  ['web', 'web-organisms-social-compositions--profile-desktop', 1280],
  ['web', 'web-organisms-social-compositions--profile-light-320', 320],
  ['web', 'web-organisms-social-compositions--profile-dark-390', 390],
  ['web', 'web-organisms-social-compositions--post-long-content-320-light', 320],
  ['web', 'web-organisms-social-compositions--post-long-content-390-dark', 390],
  ['web', 'web-organisms-social-compositions--post-featured-discussion-320-light', 320],
  ['web', 'web-organisms-messaging-thread--long-content-at-320-px', 320],
  ['web', 'web-molecules-notification-row--long-copy-narrow', 320],
  ['web', 'features-settings-settings-presentation--narrow-mobile', 390],
  ['web', 'features-settings-settings-presentation--account-and-companion-sections', 1440],
  ['web', 'features-settings-settings-presentation--dark', 390],
  ['web', 'features-booking-request-card--accepted-compact', 390],
  ['web', 'features-booking-request-card--long-notes', 390],
  ['web', 'features-booking-creation-dialog--centered-mobile-small', 320],
  ['web', 'web-booking-transactions--page', 1440],
  ['web', 'web-organisms-companion-list-item--long-content', 390],
  ['web', 'web-features-companion-application-category-browser--narrow-dark', 390],
  ['web', 'web-features-companion-application-editor-mobile-layout--first-step-at-320', 320],
  ['web', 'web-features-companion-application-editor-mobile-layout--later-step-at-390', 390],
  ['web', 'web-organisms-conversation-list-item--attachment-and-long-name', 320],
  ['web', 'web-organisms-companion-list-item--long-content', 320],
  ['web', 'web-booking-transactions--recent-transactions', 320],
  ['web', 'features-discovery-category-filter-dialog--default', 320],
  ['web', 'web-molecules-notification-row--safety-dark', 390],
  ['admin', 'admin-templates-worklist-page--populated-desktop', 1440],
  ['admin', 'admin-templates-worklist-page--long-record-at-320', 320],
  ['admin', 'admin-templates-worklist-page--narrow-dark', 390],
  ['admin', 'admin-templates-shell--narrow', 390],
  ['mobile', 'mobile-templates-app-tabs--signed-in', 390],
  ['mobile', 'mobile-templates-app-tabs--large-unread-count', 390],
  ['mobile', 'mobile-templates-screen--fixed-with-footer', 390],
  ['mobile', 'mobile-organisms-companion-card--verified-companion', 390],
  ['mobile', 'mobile-booking-bookings-header--long-balance-at-320', 320],
  ['mobile', 'mobile-settings-settings-screen--narrow-320', 320],
  ['mobile', 'mobile-settings-settings-screen--default-dark', 390],
  ['mobile', 'mobile-notifications-notification-center--long-content-at-320', 320],
  ['mobile', 'mobile-booking-plan-thread--long-date-at-320', 320],
  ['mobile', 'mobile-profile-signed-in-profile--header-actions-and-verification', 390],
  ['mobile', 'mobile-organisms-conversation-thread-presentation--header-long-identity-at-320', 320],
]

const PUBLIC_PAGES = [
  ['/', 1440],
  ['/', 390],
  ['/', 320],
  ['/privacy-policy', 1440],
  ['/privacy-policy', 390],
  ['/privacy-policy', 320],
  ['/privacy-policy', 390, 'dark'],
  ['/terms-and-conditions', 390],
  ['/terms-and-conditions', 320],
  ['/terms-and-conditions', 390, 'dark'],
  ['/safety', 390],
  ['/safety', 320],
]

import { MEASURE } from './lib/design-measure.mjs'


const args = new Set(process.argv.slice(2))
const json = args.has('--json')
const browser = await chromium.launch()
const results = []

for (const [app, id, width] of STORIES) {
  const base = app === 'mobile' ? MOBILE : WEB
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  try {
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(1400)
    const data = await page.evaluate(MEASURE)
    results.push({ app, id, width, ...data })
  } catch (error) {
    results.push({ app, id, width, error: String(error).slice(0, 200) })
  } finally {
    await page.close()
  }
}

// Public signed-out routes render outside Storybook; use the dev server.
for (const [path, width, theme = 'light'] of PUBLIC_PAGES) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } })
  await context.addInitScript((value) => {
    localStorage.setItem('lets-be-friends-theme', value)
  }, theme)
  const page = await context.newPage()
  try {
    await page.goto(`${PUBLIC}${path}`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(1200)
    const data = await page.evaluate(MEASURE)
    results.push({ app: 'public', id: `${path} (${theme})`, width, ...data })
  } catch (error) {
    results.push({ app: 'public', id: `${path} (${theme})`, width, error: String(error).slice(0, 200) })
  } finally {
    await context.close()
  }
}

await browser.close()

if (json) {
  console.log(JSON.stringify(results, null, 2))
  process.exit(0)
}

let failures = 0
for (const r of results) {
  if (r.error) {
    console.log(`ERROR ${r.app}/${r.id} @${r.width}: ${r.error}`)
    failures += 1
    continue
  }
  const low = r.below13.length ? ` <13px:${r.below13.length}` : ''
  const overflow = r.overflowX > 0 ? ` OVERFLOW +${r.overflowX}px` : ''
  const targets = r.unexpectedTargets.length ? ` TARGETS:${r.unexpectedTargets.length}` : ''
  const contrastFail = r.contrastFailures.length ? ` CONTRAST:${r.contrastFailures.length}` : ''
  const unverified = r.unverifiedContrast.length ? ` UNVERIFIED:${r.unverifiedContrast.length}` : ''
  const worst = r.worstContrast[0] ? ` contrast ${r.worstContrast[0].ratio}` : ''
  const h1Bad = (r.h1Sizes || []).filter((size) => size < 28 || size > 40)
  const pass = r.minFont >= 13 && r.overflowX <= 0 && r.unexpectedTargets.length === 0 && h1Bad.length === 0 && r.contrastFailures.length === 0 && r.unverifiedContrast.length === 0
  if (!pass) failures += 1
  const h1 = h1Bad.length ? ` H1:${h1Bad.join(',')}` : ''
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${String(r.width).padStart(4)} ${r.app.padEnd(6)} ${r.id} min=${r.minFont}${low}${overflow}${targets}${contrastFail}${unverified}${h1}${worst}`)
}
console.log(`\n${results.length - failures}/${results.length} surfaces pass the type floor, h1 scale, overflow, target, and contrast gates.`)
console.log('Documented target exceptions: inline author and host name links.')
process.exit(failures ? 1 : 0)
