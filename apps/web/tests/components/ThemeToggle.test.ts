// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, readStoredTheme, saveTheme } from '../../src/design-system/atoms/ThemeToggle'

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it.each(['light', 'dark'] as const)(
    'applies and saves %s mode',
    (theme) => {
      saveTheme(theme)
      expect(readStoredTheme()).toBe(theme)
      expect(document.documentElement.dataset.theme).toBe(theme)
      applyTheme(theme)
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark')
    },
  )
})
