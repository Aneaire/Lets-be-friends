export type NativePermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable'

export type NativePushRegistration = {
  expoPushToken: string
  projectId: string
  platform: 'ios' | 'android'
}

export type NativePushResponse = {
  data: unknown
  responseIdentifier?: string
}

export type NativeInstallation = { installationId: string; freshInstall: boolean }

export type NativePushAdapter = {
  available: boolean
  ensureInstallation: () => Promise<NativeInstallation>
  ensureNotificationChannel: () => Promise<void>
  getPermissionState: () => Promise<NativePermissionState>
  requestPermission: () => Promise<NativePermissionState>
  getRegistration: () => Promise<NativePushRegistration | null>
  unregister: () => Promise<void>
  openSettings: () => Promise<void>
  setBadgeCount: (count: number) => Promise<void>
  getLastResponse: () => Promise<NativePushResponse | null>
  addResponseListener: (listener: (response: NativePushResponse) => void) => () => void
  addTokenListener: (listener: () => void) => () => void
  addForegroundListener: (listener: () => void) => () => void
}

export const nativePushAdapter: NativePushAdapter = {
  available: false,
  ensureInstallation: async () => ({ installationId: '', freshInstall: false }),
  ensureNotificationChannel: async () => {},
  getPermissionState: async () => 'unavailable',
  requestPermission: async () => 'unavailable',
  getRegistration: async () => null,
  unregister: async () => {},
  openSettings: async () => {},
  setBadgeCount: async () => {},
  getLastResponse: async () => null,
  addResponseListener: () => () => {},
  addTokenListener: () => () => {},
  addForegroundListener: () => () => {},
}
