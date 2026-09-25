#!/usr/bin/env node
// Enforce accessible web control contrast while preserving brand accents.
//
// The logo/brand accents stay exact (#1093ED self, #C1519C social). Control
// surfaces use derived, darker tokens so white control text reaches WCAG AA
// (4.5:1) in default and hover states. This mirrors the mobile theme tokens
// selfControl / socialControl. The check reads the real stylesheets, so it fails
// if someone points a button back at a token that cannot carry white text.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repoRoot = new URL('../', import.meta.url)
const stylesPath = fileURLToPath(new URL('apps/web/src/styles.css', repoRoot))
const compactPath = fileURLToPath(new URL('apps/web/src/design-system/foundations/compact.css', repoRoot))

const MIN_CONTRAST = 4.5
const BRAND_ACCENTS = { self: '#1093ED', social: '#C1519C' }

function readToken(css, name) {
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(css)
  if (!match) throw new Error(`token --${name} is not defined`)
  return match[1].trim()
}

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  const expanded = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) throw new Error(`unsupported color value: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(expanded.slice(i, i + 2), 16) / 255)
}

function channel(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

function main() {
  const styles = readFileSync(stylesPath, 'utf8')
  const compact = readFileSync(compactPath, 'utf8')
  const errors = []

  for (const [intent, hex] of Object.entries(BRAND_ACCENTS)) {
    if (!styles.includes(`--accent-${intent}-button: ${hex};`)) {
      errors.push(`brand accent --accent-${intent}-button must stay ${hex}`)
    }
  }

  let foreground
  try {
    foreground = readToken(styles, 'accent-control-foreground')
  } catch (error) {
    errors.push(error.message)
  }

  const controls = ['accent-self-control', 'accent-self-control-hover', 'accent-social-control', 'accent-social-control-hover']
  for (const token of controls) {
    let background
    try {
      background = readToken(styles, token)
    } catch (error) {
      errors.push(error.message)
      continue
    }
    if (foreground && background.startsWith('#')) {
      const ratio = contrast(foreground, background)
      if (ratio < MIN_CONTRAST) {
        errors.push(`control text contrast ${ratio.toFixed(2)}:1 for ${token} is below ${MIN_CONTRAST}:1`)
      }
    }
  }

  if (!/\.btn\.btn-self[\s\S]*?background:\s*var\(--accent-self-control\)/.test(styles)) {
    errors.push('.btn.btn-self must use --accent-self-control for its background')
  }
  if (!/\.btn\.btn-social[\s\S]*?background:\s*var\(--accent-social-control\)/.test(styles)) {
    errors.push('.btn.btn-social must use --accent-social-control for its background')
  }
  if (!/\.btn-self:hover[\s\S]*?background:\s*var\(--accent-self-control-hover\)/.test(styles)) {
    errors.push('.btn-self:hover must use --accent-self-control-hover')
  }
  if (!/\.btn-social:hover[\s\S]*?background:\s*var\(--accent-social-control-hover\)/.test(styles)) {
    errors.push('.btn-social:hover must use --accent-social-control-hover')
  }
  if (!/\.btn-self,[\s\S]*?\.btn-social[\s\S]*?color:\s*var\(--accent-control-foreground\)/.test(compact)) {
    errors.push('compact.css must keep the accessible control foreground on .btn-self and .btn-social')
  }

  if (errors.length) {
    console.error(`Web control contrast check failed with ${errors.length} issue(s):`)
    for (const error of errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  console.log(`Web control contrast check passed (white text >= ${MIN_CONTRAST}:1 on derived control tokens; brand accents exact).`)
}

main()
