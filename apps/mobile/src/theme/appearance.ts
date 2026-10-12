import type { ColorScheme } from './tokens'

export type ThemePreference = 'light' | 'dark' | 'system'

export type SystemScheme = 'light' | 'dark'

export const appearanceStorageKey = 'lbf-theme-preference-v1'

export const appearanceOptions: ReadonlyArray<{
  value: ThemePreference
  label: string
  description: string
}> = [
  { value: 'light', label: 'Light', description: 'Always use the light theme.' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme.' },
  { value: 'system', label: 'System', description: 'Follow this device appearance setting.' },
]

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (isThemePreference(value)) return value
  return 'system'
}

export function serializeThemePreference(value: ThemePreference): string {
  return value
}

export function resolveEffectiveScheme(
  preference: ThemePreference | null | undefined,
  systemScheme: SystemScheme | null | undefined,
): ColorScheme {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return systemScheme === 'dark' ? 'dark' : 'light'
}

export type AppearanceStorageStatus = 'loading' | 'ready' | 'unavailable' | 'error'

export type AppearanceState = {
  status: AppearanceStorageStatus
  preference: ThemePreference
  message: string
}

export function initialAppearanceState(): AppearanceState {
  return {
    status: 'loading',
    preference: 'system',
    message: 'Loading your appearance choice.',
  }
}

export function appearanceStateForLoad(
  result: { ok: true; stored: string | null } | { ok: false; unavailable: boolean },
): AppearanceState {
  if (result.ok) {
    return {
      status: 'ready',
      preference: parseThemePreference(result.stored),
      message: '',
    }
  }
  if (result.unavailable) {
    return {
      status: 'unavailable',
      preference: 'system',
      message: 'Appearance choices are not saved on this device. The system theme is used instead.',
    }
  }
  return {
    status: 'error',
    preference: 'system',
    message: 'Your appearance choice could not be loaded. The system theme is used for now.',
  }
}

export function appearanceStateForSave(
  current: AppearanceState,
  preference: ThemePreference,
  result: { ok: true } | { ok: false; unavailable: boolean },
): AppearanceState {
  if (result.ok) return { status: 'ready', preference, message: '' }
  if (result.unavailable) {
    return {
      status: 'unavailable',
      preference,
      message: 'Appearance choices are not saved on this device. Your choice applies until the app restarts.',
    }
  }
  return {
    status: 'error',
    preference,
    message: 'Your appearance choice could not be saved. It applies until the app restarts.',
  }
}

export interface AppearanceStorage {
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

export async function loadThemePreference(
  storage: AppearanceStorage,
): Promise<{ ok: true; stored: string | null } | { ok: false; unavailable: boolean }> {
  try {
    return { ok: true, stored: await storage.read() }
  } catch (error) {
    return { ok: false, unavailable: isUnavailableError(error) }
  }
}

export async function saveThemePreference(
  storage: AppearanceStorage,
  preference: ThemePreference,
): Promise<{ ok: true } | { ok: false; unavailable: boolean }> {
  try {
    await storage.write(serializeThemePreference(preference))
    return { ok: true }
  } catch (error) {
    return { ok: false, unavailable: isUnavailableError(error) }
  }
}

function isUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === 'ERR_UNAVAILABLE' || code === 'Unavailable'
}

export function appearanceChoiceLabel(preference: ThemePreference): string {
  return appearanceOptions.find((option) => option.value === preference)?.label ?? 'System'
}
