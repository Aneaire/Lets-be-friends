/**
 * Shared browser-side measurement for design audits. Runs inside page.evaluate.
 * Keep it self-contained: no imports, no outer variables.
 */
export const MEASURE = () => {
  const parseColor = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value || '')
    if (!m) return null
    const parts = m[1].split(/[,/]/).map((x) => parseFloat(x.trim()))
    const [r, g, b] = parts
    const a = parts.length > 3 ? parts[3] : 1
    return { r, g, b, a }
  }
  const composite = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: fg.a + bg.a * (1 - fg.a),
  })
  const pageBase = () => {
    for (const el of [document.body, document.documentElement]) {
      const c = parseColor(getComputedStyle(el).backgroundColor)
      if (c && c.a >= 0.999) return c
    }
    return document.documentElement.classList.contains('dark')
      ? { r: 9, g: 9, b: 9, a: 1 }
      : { r: 255, g: 255, b: 255, a: 1 }
  }
  const backgroundOf = (el) => {
    let node = el
    let acc = null
    let guard = 0
    while (node && guard < 60) {
      const style = getComputedStyle(node)
      if (style.backgroundImage && style.backgroundImage !== 'none') return { image: true }
      const c = parseColor(style.backgroundColor)
      if (c && c.a > 0) acc = acc ? composite(acc, c) : c
      if (acc && acc.a >= 0.999) return acc
      node = node.parentElement
      guard += 1
    }
    return acc ? composite(acc, pageBase()) : pageBase()
  }
  const luminance = (c) => {
    const f = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => {
    const l1 = luminance(a)
    const l2 = luminance(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const isVisible = (el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 1 || rect.height <= 1) return false
    const style = getComputedStyle(el)
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.15
  }

  const textNodes = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim()
    if (!text) continue
    if (text.length <= 2 && [...text].every((ch) => {
      const code = ch.codePointAt(0)
      return code >= 0xe000 && code <= 0xf8ff
    })) continue
    const el = walker.currentNode.parentElement
    if (!el || seen.has(el) || !isVisible(el)) continue
    if (el.closest('[aria-hidden="true"]')) continue
    seen.add(el)
    textNodes.push({ el, text })
  }

  const fontSizes = []
  const contrast = []
  const unverifiedContrast = []
  for (const { el, text } of textNodes) {
    const style = getComputedStyle(el)
    const size = parseFloat(style.fontSize)
    const label = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : '')
    fontSizes.push({ size, label, text: text.slice(0, 40) })
    const fg = parseColor(style.color)
    if (!fg) continue
    const bg = backgroundOf(el)
    if (bg.image) {
      unverifiedContrast.push({ size, label, text: text.slice(0, 40) })
      continue
    }
    const blended = fg.a < 1 ? composite(fg, bg) : fg
    contrast.push({ ratio: Number(ratio(blended, bg).toFixed(2)), size, label, text: text.slice(0, 40) })
  }

  const isDocumentedException = (el, rect) => {
    const cls = typeof el.className === 'string' ? el.className : ''
    if (el.href && el.href.includes('storybook.js.org')) return true
    const inlineLinkClasses = [
      'social-post-author-link',
      'discover-host-name-link',
      'social-shared-embed-author',
      'social-inline-link',
      'social-review-companion',
    ]
    if (inlineLinkClasses.some((name) => cls.includes(name))) return true
    if (el.closest('.maplibregl-ctrl-attrib')) return true
    if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.closest('label')) {
      const label = el.closest('label').getBoundingClientRect()
      if (label.height >= 43) return true
    }
    return false
  }

  const smallTargets = []
  const unexpectedTargets = []
  const checkTargets = window.innerWidth <= 480
  if (checkTargets) {
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="link"]')) {
      if (!isVisible(el)) continue
      const rect = el.getBoundingClientRect()
      if (rect.width <= 2 && rect.height <= 2) continue
      if (rect.width < 44 || rect.height < 44) {
        const item = {
          label: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          exception: isDocumentedException(el, rect),
        }
        smallTargets.push(item)
        if (!item.exception) unexpectedTargets.push(item)
      }
    }
  }

  const h1Sizes = [...document.querySelectorAll('h1, .text-h1')]
    .filter(isVisible)
    .map((el) => Math.round(parseFloat(getComputedStyle(el).fontSize)))

  const root = document.scrollingElement || document.documentElement
  return {
    h1Sizes,
    h1Count: h1Sizes.length,
    docWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    overflowX: root.scrollWidth - root.clientWidth,
    minFont: fontSizes.length ? Math.min(...fontSizes.map((f) => f.size)) : null,
    below13: fontSizes.filter((f) => f.size < 13).slice(0, 12),
    worstContrast: contrast.sort((a, b) => a.ratio - b.ratio).slice(0, 8),
    contrastFailures: contrast.filter((c) => (c.size >= 24 ? c.ratio < 3 : c.ratio < 4.5)).slice(0, 8),
    unverifiedContrast,
    smallTargets: smallTargets.slice(0, 20),
    unexpectedTargets: unexpectedTargets.slice(0, 20),
    targetCount: smallTargets.length,
  }
}
