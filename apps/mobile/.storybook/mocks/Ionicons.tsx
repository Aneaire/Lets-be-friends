/// <reference path="../types.d.ts" />
import ioniconsFontUrl from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'
import type { CSSProperties } from 'react'

const FONT_FAMILY = 'Ionicons'
const glyphs = glyphMap as Record<string, number>

export function resolveIoniconsGlyph(name: string): string {
  const codepoint = glyphs[name]
  return typeof codepoint === 'number' ? String.fromCodePoint(codepoint) : '?'
}

let fontRegistered = false

function ensureIoniconsFont() {
  if (fontRegistered || typeof document === 'undefined') return
  fontRegistered = true
  const style = document.createElement('style')
  style.setAttribute('data-storybook-ionicons-font', '')
  style.textContent = `@font-face { font-family: '${FONT_FAMILY}'; src: url('${ioniconsFontUrl}') format('truetype'); font-display: block; }`
  document.head.append(style)
}

type IoniconsProps = {
  color?: string
  name: string
  size?: number
  style?: CSSProperties
}

export default function Ionicons({ color = 'currentColor', name, size = 20, style }: IoniconsProps) {
  ensureIoniconsFont()

  return (
    <span
      aria-hidden="true"
      style={{
        color,
        display: 'inline-block',
        fontFamily: `'${FONT_FAMILY}'`,
        fontSize: size,
        fontStyle: 'normal',
        fontWeight: 'normal',
        lineHeight: 1,
        ...style,
      }}>
      {resolveIoniconsGlyph(name)}
    </span>
  )
}
