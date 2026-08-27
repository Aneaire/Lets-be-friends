import {
  ANDROID_NOTIFICATION_CHANNEL_ID,
  androidNotificationChannelSettings,
  foregroundPermissionAction,
  installationBoundary,
  parsePushPayload,
  parsePushPreference,
  pushInstallationKey,
  pushInstallMarkerKey,
  pushSettingsAction,
  pushPreferenceKey,
  resolvePushTap,
  resolvePushUiState,
  responseEventKey,
  revokePushRegistration,
  serializePushPreference,
  shouldApplyBadge,
  shouldRequestPermission,
  shouldRevokeOnSignOut,
  shouldSilentlyRefresh,
} from '@/notifications/logic'
import { nativePushAdapter } from '@/notifications/nativeAdapter.web'

jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }))
jest.mock('expo-constants', () => ({ easConfig: { projectId: 'project-id' }, expoConfig: {} }))
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }))
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  unregisterForNotificationsAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addPushTokenListener: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { SECRET: -1 },
  PermissionStatus: { DENIED: 'denied' },
}))

describe('push notification pure logic', () => {
  const readyUiInput = {
    nativeAvailable: true,
    memberReady: true,
    accountMatches: true,
    bootstrapStatus: 'ready' as const,
    backendTimedOut: false,
    serverState: { available: true, registered: false },
    busy: false,
    failed: false,
    permission: 'undetermined' as const,
    preference: { optedIn: false, pendingDisable: false },
  }

  it('shows bootstrap failure instead of leaving availability loading forever', () => {
    expect(resolvePushUiState({
      ...readyUiInput,
      accountMatches: false,
      bootstrapStatus: 'error',
      serverState: undefined,
    })).toEqual({
      status: 'availability_error',
      message: 'Notification availability could not be checked. Please try again.',
    })
  })

  it('bounds backend loading and recovers when server state arrives', () => {
    expect(resolvePushUiState({ ...readyUiInput, backendTimedOut: false, serverState: undefined }).status).toBe('loading')
    expect(resolvePushUiState({ ...readyUiInput, backendTimedOut: true, serverState: undefined }).status).toBe('availability_error')
    expect(resolvePushUiState({ ...readyUiInput, backendTimedOut: true }).status).toBe('disabled')
  })

  it('keeps a normally available unregistered device disabled and actionable', () => {
    expect(resolvePushUiState(readyUiInput)).toEqual({
      status: 'disabled',
      message: 'Push notifications are off for this account on this device.',
    })
  })

  it('uses a new high-importance Android channel for visible account updates', () => {
    expect(ANDROID_NOTIFICATION_CHANNEL_ID).toBe('account-updates-v2')
    expect(androidNotificationChannelSettings({ highImportance: 4, secretVisibility: -1 })).toEqual({
      name: 'Account updates',
      importance: 4,
      lockscreenVisibility: -1,
      sound: 'default',
      vibrationPattern: [0, 180],
      enableLights: false,
      showBadge: true,
    })
  })

  it('maps availability retry separately from enabling notifications', () => {
    expect(pushSettingsAction('availability_error')).toBe('retry_availability')
    expect(pushSettingsAction('loading')).toBe('none')
    expect(pushSettingsAction('disabled')).toBe('enable')
    expect(pushSettingsAction('error')).toBe('enable')
  })

  it('strictly accepts only the opaque versioned payload', () => {
    expect(parsePushPayload({ version: 1, notificationId: 'notification-1' })).toEqual({ version: 1, notificationId: 'notification-1' })
    expect(parsePushPayload({ version: 1, notificationId: 'notification-1', route: '/messages' })).toBeNull()
    expect(parsePushPayload({ version: 2, notificationId: 'notification-1' })).toBeNull()
    expect(parsePushPayload({ version: 1, notificationId: '' })).toBeNull()
    expect(parsePushPayload('notification-1')).toBeNull()
  })

  it('keeps opt-in and pending cleanup scoped to a Clerk account', () => {
    expect(pushPreferenceKey('user-a')).not.toBe(pushPreferenceKey('user-b'))
    expect(pushPreferenceKey('user:with/slash')).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(pushInstallationKey()).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(pushInstallMarkerKey()).toMatch(/^[A-Za-z0-9._-]+$/)
    const stored = serializePushPreference({ optedIn: true, pendingDisable: true })
    expect(parsePushPreference(stored)).toEqual({ optedIn: true, pendingDisable: true })
    expect(parsePushPreference('invalid')).toEqual({ optedIn: false, pendingDisable: false })
  })

  it('treats a missing or changed cache marker as a fresh install boundary', () => {
    expect(installationBoundary({ secureMarker: 'marker', fileMarker: 'marker', storedInstallationId: 'installation' })).toEqual({ freshInstall: false, installationId: 'installation' })
    expect(installationBoundary({ secureMarker: 'marker', fileMarker: null, storedInstallationId: 'installation' })).toEqual({ freshInstall: true })
    expect(installationBoundary({ secureMarker: 'marker', fileMarker: 'changed', storedInstallationId: 'installation' })).toEqual({ freshInstall: true })
  })

  it('honors opt-in, pending cleanup, and actual registration at sign-out', () => {
    expect(shouldRevokeOnSignOut({ optedIn: true, pendingDisable: false, registered: false })).toBe(true)
    expect(shouldRevokeOnSignOut({ optedIn: false, pendingDisable: true, registered: false })).toBe(true)
    expect(shouldRevokeOnSignOut({ optedIn: false, pendingDisable: false, registered: true })).toBe(true)
    expect(shouldRevokeOnSignOut({ optedIn: false, pendingDisable: false, registered: false })).toBe(false)
  })

  it('requests permission only from an explicit ready action', () => {
    expect(shouldRequestPermission({ explicit: true, memberReady: true, backendAvailable: true })).toBe(true)
    expect(shouldRequestPermission({ explicit: false, memberReady: true, backendAvailable: true })).toBe(false)
    expect(shouldRequestPermission({ explicit: true, memberReady: false, backendAvailable: true })).toBe(false)
  })

  it('silently refreshes only a previously opted-in matching ready account', () => {
    expect(shouldSilentlyRefresh({ optedIn: true, permissionGranted: true, accountMatches: true, memberReady: true, backendAvailable: true })).toBe(true)
    expect(shouldSilentlyRefresh({ optedIn: false, permissionGranted: true, accountMatches: true, memberReady: true, backendAvailable: true })).toBe(false)
    expect(shouldSilentlyRefresh({ optedIn: true, permissionGranted: true, accountMatches: false, memberReady: true, backendAvailable: true })).toBe(false)
  })

  it('disables on foreground permission loss and re-registers when permission returns', () => {
    expect(foregroundPermissionAction({ optedIn: true, previousPermission: 'granted', currentPermission: 'denied', memberReady: true, backendAvailable: true })).toBe('disable')
    expect(foregroundPermissionAction({ optedIn: true, previousPermission: 'denied', currentPermission: 'granted', memberReady: true, backendAvailable: true })).toBe('register')
    expect(foregroundPermissionAction({ optedIn: false, previousPermission: 'granted', currentPermission: 'denied', memberReady: true, backendAvailable: true })).toBe('none')
    expect(foregroundPermissionAction({ optedIn: true, previousPermission: 'granted', currentPermission: 'denied', memberReady: true, backendAvailable: false })).toBe('disable')
    expect(foregroundPermissionAction({ optedIn: true, previousPermission: 'unavailable', currentPermission: 'denied', memberReady: true, backendAvailable: true })).toBe('disable')
    expect(foregroundPermissionAction({ optedIn: true, previousPermission: 'granted', currentPermission: 'denied', memberReady: false, backendAvailable: true })).toBe('none')
  })

  it('persists failed revocation and clears it after a later retry', async () => {
    const writes: Array<{ optedIn: boolean; pendingDisable: boolean }> = []
    const unregisterNative = jest.fn().mockResolvedValue(undefined)
    const first = await revokePushRegistration({
      preference: { optedIn: false, pendingDisable: false },
      persist: async (value) => { writes.push(value) },
      unregisterNative,
      disableServer: async () => { throw new Error('offline') },
    })
    expect(first).toEqual({ acknowledged: false, preference: { optedIn: false, pendingDisable: true } })
    expect(unregisterNative).toHaveBeenCalledTimes(1)
    const second = await revokePushRegistration({
      preference: first.preference,
      persist: async (value) => { writes.push(value) },
      unregisterNative,
      disableServer: async () => {},
    })
    expect(second).toEqual({ acknowledged: true, preference: { optedIn: false, pendingDisable: false } })
    expect(writes).toEqual([
      { optedIn: false, pendingDisable: true },
      { optedIn: false, pendingDisable: true },
      { optedIn: false, pendingDisable: false },
    ])
  })

  it('still revokes when initial persistence fails and clears pending on a later retry', async () => {
    const unregisterNative = jest.fn().mockResolvedValue(undefined)
    const disableServer = jest.fn().mockResolvedValue(undefined)
    const firstPersist = jest.fn().mockRejectedValue(new Error('secure store unavailable'))
    const first = await revokePushRegistration({
      preference: { optedIn: false, pendingDisable: false },
      persist: firstPersist,
      unregisterNative,
      disableServer,
    })
    expect(first).toEqual({ acknowledged: false, preference: { optedIn: false, pendingDisable: true } })
    expect(unregisterNative).toHaveBeenCalledTimes(1)
    expect(disableServer).toHaveBeenCalledTimes(1)

    const retryPersist = jest.fn().mockResolvedValue(undefined)
    const second = await revokePushRegistration({
      preference: first.preference,
      persist: retryPersist,
      unregisterNative,
      disableServer,
    })
    expect(second).toEqual({ acknowledged: true, preference: { optedIn: false, pendingDisable: false } })
    expect(unregisterNative).toHaveBeenCalledTimes(2)
    expect(disableServer).toHaveBeenCalledTimes(2)
    expect(retryPersist).toHaveBeenNthCalledWith(1, { optedIn: false, pendingDisable: true })
    expect(retryPersist).toHaveBeenNthCalledWith(2, { optedIn: false, pendingDisable: false })
  })

  it('keeps transient tap failures retryable and handles a later success', async () => {
    const navigate = jest.fn()
    const open = jest.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'ready', destination: { type: 'notifications' } })
    expect(await resolvePushTap({ open, navigate })).toEqual({ handled: false, terminal: false })
    expect(await resolvePushTap({ open, navigate })).toEqual({ handled: true, terminal: false })
    expect(navigate).toHaveBeenCalledWith({ type: 'notifications' })
    await expect(resolvePushTap({ open: async () => ({ status: 'unavailable' }), navigate })).resolves.toEqual({ handled: true, terminal: true })
  })

  it('validates badge values and deduplicates response keys', () => {
    expect(shouldApplyBadge(0)).toBe(true)
    expect(shouldApplyBadge(4)).toBe(true)
    expect(shouldApplyBadge(-1)).toBe(false)
    expect(responseEventKey({ notificationId: 'n1', responseIdentifier: 'tap' })).toBe('n1:tap')
  })

  it('keeps the web adapter inert', async () => {
    expect(nativePushAdapter.available).toBe(false)
    expect(await nativePushAdapter.getRegistration()).toBeNull()
    expect(await nativePushAdapter.getLastResponse()).toBeNull()
    expect(await nativePushAdapter.ensureInstallation()).toEqual({ installationId: '', freshInstall: false })
    await expect(nativePushAdapter.ensureNotificationChannel()).resolves.toBeUndefined()
    await expect(nativePushAdapter.unregister()).resolves.toBeUndefined()
    await expect(nativePushAdapter.openSettings()).resolves.toBeUndefined()
    await expect(nativePushAdapter.setBadgeCount(5)).resolves.toBeUndefined()
  })
})
