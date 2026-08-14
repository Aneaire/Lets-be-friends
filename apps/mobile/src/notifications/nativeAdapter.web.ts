import type { NativePushAdapter } from './nativeAdapter'

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
