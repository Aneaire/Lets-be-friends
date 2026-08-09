// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyAccentChoice,
  readStoredAccentChoice,
  saveAccentChoice,
} from './ThemeToggle'

describe('accent theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.accentTheme
  })

  it('uses the default accent treatment when no preference is saved', () => {
    expect(readStoredAccentChoice()).toBe('default')
  })

  it.each(['default', 'reversed', 'blue', 'pink'] as const)(
    'applies and saves the %s treatment',
    (accent) => {
      saveAccentChoice(accent)

      expect(readStoredAccentChoice()).toBe(accent)
      expect(document.documentElement.dataset.accentTheme).toBe(accent)
    },
  )

  it('ignores an unsupported saved value', () => {
    window.localStorage.setItem('lets-be-friends-accent-theme', 'purple')
    applyAccentChoice(readStoredAccentChoice())

    expect(document.documentElement.dataset.accentTheme).toBe('default')
  })
})
