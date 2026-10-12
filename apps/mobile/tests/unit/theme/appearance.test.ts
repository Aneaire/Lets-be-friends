import {
  appearanceStateForLoad,
  appearanceStateForSave,
  initialAppearanceState,
  isThemePreference,
  loadThemePreference,
  parseThemePreference,
  resolveEffectiveScheme,
  saveThemePreference,
  type AppearanceStorage,
} from '@/theme/appearance'

function memoryStorage(initial: string | null = null): AppearanceStorage & { writes: string[] } {
  let stored = initial
  const writes: string[] = []
  return {
    writes,
    async read() {
      return stored
    },
    async write(value: string) {
      writes.push(value)
      stored = value
    },
  }
}

describe('appearance preference contracts', () => {
  it('accepts only explicit light, dark, or system choices', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference(undefined)).toBe('system')
    expect(parseThemePreference('auto')).toBe('system')
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('banana')).toBe(false)
  })

  it('resolves explicit choices over the device scheme and falls back safely', () => {
    expect(resolveEffectiveScheme('light', 'dark')).toBe('light')
    expect(resolveEffectiveScheme('dark', 'light')).toBe('dark')
    expect(resolveEffectiveScheme('system', 'dark')).toBe('dark')
    expect(resolveEffectiveScheme('system', 'light')).toBe('light')
    expect(resolveEffectiveScheme('system', null)).toBe('light')
    expect(resolveEffectiveScheme(undefined, undefined)).toBe('light')
  })

  it('starts loading with the system choice until storage answers', () => {
    expect(initialAppearanceState()).toEqual({
      status: 'loading',
      preference: 'system',
      message: 'Loading your appearance choice.',
    })
  })

  it('keeps the stored choice on load and falls back to system when empty or invalid', async () => {
    expect(appearanceStateForLoad({ ok: true, stored: 'dark' })).toMatchObject({ status: 'ready', preference: 'dark' })
    expect(appearanceStateForLoad({ ok: true, stored: null })).toMatchObject({ status: 'ready', preference: 'system' })
    expect(appearanceStateForLoad({ ok: true, stored: 'sepia' })).toMatchObject({ status: 'ready', preference: 'system' })

    const loaded = await loadThemePreference(memoryStorage('light'))
    expect(loaded).toEqual({ ok: true, stored: 'light' })
  })

  it('reports unavailable storage without crashing and keeps a product-safe message', () => {
    const unavailable = appearanceStateForLoad({ ok: false, unavailable: true })
    expect(unavailable.status).toBe('unavailable')
    expect(unavailable.preference).toBe('system')
    expect(unavailable.message).toMatch(/not saved on this device/i)

    const error = appearanceStateForLoad({ ok: false, unavailable: false })
    expect(error.status).toBe('error')
    expect(error.message).toMatch(/could not be loaded/i)
  })

  it('persists the chosen theme and applies it even when saving fails', async () => {
    const storage = memoryStorage()
    expect(await saveThemePreference(storage, 'dark')).toEqual({ ok: true })
    expect(storage.writes).toEqual(['dark'])

    const ready = appearanceStateForSave(initialAppearanceState(), 'dark', { ok: true })
    expect(ready).toMatchObject({ status: 'ready', preference: 'dark', message: '' })

    const failed = appearanceStateForSave(ready, 'light', { ok: false, unavailable: false })
    expect(failed.status).toBe('error')
    expect(failed.preference).toBe('light')
    expect(failed.message).toMatch(/could not be saved/i)
    expect(failed.message).toMatch(/until the app restarts/i)

    const unavailable = appearanceStateForSave(ready, 'system', { ok: false, unavailable: true })
    expect(unavailable.status).toBe('unavailable')
    expect(unavailable.preference).toBe('system')
    expect(unavailable.message).toMatch(/until the app restarts/i)
  })

  it('maps secure-store unavailability to the unavailable state', async () => {
    const unavailableStorage: AppearanceStorage = {
      async read() {
        throw Object.assign(new Error('missing'), { code: 'ERR_UNAVAILABLE' })
      },
      async write() {
        throw Object.assign(new Error('missing'), { code: 'ERR_UNAVAILABLE' })
      },
    }
    expect(await loadThemePreference(unavailableStorage)).toEqual({ ok: false, unavailable: true })
    expect(await saveThemePreference(unavailableStorage, 'light')).toEqual({ ok: false, unavailable: true })

    const genericFailure: AppearanceStorage = {
      async read() {
        throw new Error('disk busy')
      },
      async write() {
        throw new Error('disk busy')
      },
    }
    expect(await loadThemePreference(genericFailure)).toEqual({ ok: false, unavailable: false })
    expect(await saveThemePreference(genericFailure, 'dark')).toEqual({ ok: false, unavailable: false })
  })
})
