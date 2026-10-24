import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const [cdp, out] = process.argv.slice(2)
const browser = await chromium.connectOverCDP(cdp)
const context = browser.contexts()[0]
const page = context.pages()[0] ?? await context.newPage()
await page.setViewportSize({ width: 1280, height: 950 })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const style = document.createElement('style')
  style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'
  document.head.appendChild(style)
})
const client = await context.newCDPSession(page)
const { data } = await client.send('Page.captureScreenshot', { format: 'png' })
writeFileSync(out, Buffer.from(data, 'base64'))
console.log(JSON.stringify({ url: page.url(), title: await page.title(), frames: page.frames().map((f) => f.url()).slice(0, 4) }, null, 2))
await browser.close()
