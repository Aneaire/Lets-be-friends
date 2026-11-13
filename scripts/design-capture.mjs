#!/usr/bin/env node
/**
 * Capture the design review screenshots from the Storybook builds and fail
 * loudly when a story renders blank or errors, so a stale or broken canvas is
 * never cited as evidence.
 *
 * Requires the two static builds to be served on 6006 and 6007.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const WEB = 'http://localhost:6006'
const MOBILE = 'http://localhost:6007'
const OUT = '.playwright-mcp/review'

const SHOTS = [
  ['web', 'web-organisms-home-imagery--home-desktop-light', 1440, 'Home signed in', 'Home'],
  ['web', 'web-organisms-home-imagery--home-desktop-dark', 1440, 'Home signed in dark', 'Home'],
  ['web', 'web-organisms-home-imagery--home-320-light', 320, 'Home 320', 'Home'],
  ['web', 'web-organisms-home-imagery--home-390-dark', 390, 'Home 390 dark', 'Home'],
  ['web', 'features-settings-settings-presentation--account-and-companion-sections', 1440, 'Settings desktop', 'Settings'],
  ['web', 'features-settings-settings-presentation--narrow-mobile', 390, 'Settings 390', 'Settings'],
  ['web', 'features-settings-settings-presentation--dark', 390, 'Settings 390 dark', 'Settings'],
  ['web', 'web-templates-workspace-shell--bookings-with-status', 1440, 'Bookings desktop', 'Your bookings'],
  ['web', 'web-templates-workspace-shell--mobile-navigation-320', 320, 'Bookings 320', 'Your bookings'],
  ['web', 'web-templates-workspace-shell--dark', 1440, 'Bookings dark', 'Your bookings'],
  ['web', 'web-booking-transactions--page', 1440, 'Transactions', 'Transactions'],
  ['web', 'web-organisms-social-compositions--profile-desktop', 1280, 'Profile desktop', 'Mara Reyes'],
  ['web', 'web-organisms-social-compositions--profile-light-320', 320, 'Profile 320', 'Mara Reyes'],
  ['web', 'web-organisms-social-compositions--post-long-content-390-dark', 390, 'Feed post dark 390', ''],
  ['web', 'web-organisms-messaging-thread--long-content-at-320-px', 320, 'Message thread 320', ''],
  ['web', 'web-molecules-notification-row--long-copy-narrow', 320, 'Notification row 320', ''],
  ['web', 'features-booking-creation-dialog--centered-mobile-small', 320, 'Booking dialog 320', ''],
  ['web', 'web-organisms-companion-list-item--long-content', 390, 'Discover row 390', 'Niko'],
  ['web', 'web-features-companion-application-category-browser--narrow-dark', 390, 'Filter dialog dark 390', ''],
  ['web', 'web-features-companion-application-editor-mobile-layout--first-step-at-320', 320, 'Companion editor 320', ''],
  ['web', 'web-templates-app-shell-chrome--mobile-header-dark', 390, 'Mobile header dark', ''],
  ['admin', 'admin-templates-worklist-page--populated-desktop', 1440, 'Admin worklist desktop', 'Reports'],
  ['admin', 'admin-templates-worklist-page--long-record-at-320', 320, 'Admin worklist 320', 'Reports'],
  ['admin', 'admin-templates-worklist-page--narrow-dark', 390, 'Admin worklist dark 390', 'Reports'],
  ['admin', 'admin-templates-shell--narrow', 390, 'Admin shell 390', ''],
  ['mobile', 'mobile-templates-app-tabs--signed-in', 390, 'Mobile tabs', 'Home'],
  ['mobile', 'mobile-templates-app-tabs--large-unread-count', 390, 'Mobile tabs unread', 'Home'],
  ['mobile', 'mobile-settings-settings-screen--narrow-320', 320, 'Mobile settings 320', 'Settings'],
  ['mobile', 'mobile-settings-settings-screen--default-dark', 390, 'Mobile settings dark', 'Settings'],
  ['mobile', 'mobile-booking-bookings-header--long-balance-at-320', 320, 'Mobile bookings 320', 'Bookings'],
  ['mobile', 'mobile-notifications-notification-center--long-content-at-320', 320, 'Mobile notifications 320', 'Notifications'],
  ['mobile', 'mobile-booking-plan-thread--long-date-at-320', 320, 'Mobile plan thread 320', ''],
  ['mobile', 'mobile-profile-signed-in-profile--header-actions-and-verification', 390, 'Mobile profile 390', ''],
  ['mobile', 'mobile-organisms-companion-card--verified-companion', 390, 'Mobile companion card', 'Arianna'],
  ['mobile', 'mobile-organisms-conversation-thread-presentation--header-long-identity-at-320', 320, 'Mobile conversation header 320', ''],
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const failures = []

for (const [app, id, width, name, landmark] of SHOTS) {
  const base = app === 'mobile' ? MOBILE : WEB
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  try {
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(app === 'mobile' ? 2500 : 1500)
    const state = await page.evaluate((mark) => {
      const text = document.body.textContent || ''
      const error = /Something went wrong|Cannot read properties|is not defined/i.test(text)
      return {
        textLength: text.trim().length,
        hasLandmark: mark ? text.includes(mark) : true,
        error,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }
    }, landmark)
    if (state.error || state.textLength < 20 || !state.hasLandmark) {
      failures.push(`${name} (${id}): error=${state.error} text=${state.textLength} landmark=${state.hasLandmark}`)
      continue
    }
    await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: true, scale: 'css' })
    if (state.scrollWidth > state.clientWidth) {
      failures.push(`${name}: horizontal overflow +${state.scrollWidth - state.clientWidth}px`)
    }
  } catch (error) {
    failures.push(`${name} (${id}): ${String(error).slice(0, 160)}`)
  } finally {
    await page.close()
  }
}

await browser.close()

if (failures.length) {
  console.error('Capture failures:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Captured ${SHOTS.length} verified screenshots into ${OUT}/`)
