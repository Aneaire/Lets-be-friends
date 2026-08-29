export type PushPayload = { version: 1; notificationId: string }

export const ANDROID_NOTIFICATION_CHANNEL_ID = 'account-updates-v2'

export function androidNotificationChannelSettings<TImportance, TVisibility>(input: {
  highImportance: TImportance
  secretVisibility: TVisibility
}) {
  return {
    name: 'Account updates',
    importance: input.highImportance,
    lockscreenVisibility: input.secretVisibility,
    sound: 'default' as const,
    vibrationPattern: [0, 180],
    enableLights: false,
    showBadge: true,
  }
}

export type PushPreference = {
  optedIn: boolean
  pendingDisable: boolean
}

export type PushRegistrationCandidate = {
  installationId: string
  expoPushToken: string
  projectId: string
  platform: 'ios' | 'android'
}

export function createPushRegistrationCoordinator() {
  const active = new Map<string, Promise<boolean>>()
  const acknowledged = new Map<string, string>()

  return {
    register(
      accountId: string,
      load: () => Promise<PushRegistrationCandidate | null>,
      persist: (candidate: PushRegistrationCandidate) => Promise<void>,
    ) {
      const current = active.get(accountId)
      if (current) return current

      const attempt = (async () => {
        const candidate = await load()
        if (!candidate) return false
        const signature = JSON.stringify([
          candidate.installationId,
          candidate.expoPushToken,
          candidate.projectId,
          candidate.platform,
        ])
        if (acknowledged.get(accountId) === signature) return true
        await persist(candidate)
        acknowledged.set(accountId, signature)
        return true
      })()

      active.set(accountId, attempt)
      const clear = () => {
        if (active.get(accountId) === attempt) active.delete(accountId)
      }
      void attempt.then(clear, clear)
      return attempt
    },
    reset(accountId: string) {
      acknowledged.delete(accountId)
    },
  }
}

export type PushUiState =
  | { status: 'unavailable'; message: string }
  | { status: 'loading'; message: string }
  | { status: 'availability_error'; message: string }
  | { status: 'pending_disable'; message: string }
  | { status: 'disabled'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'enabled'; message: string }
  | { status: 'error'; message: string }

export function resolvePushUiState(input: {
  nativeAvailable: boolean
  memberReady: boolean
  accountMatches: boolean
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error'
  backendTimedOut: boolean
  serverState?: { available: boolean; registered: boolean }
  busy: boolean
  failed: boolean
  permission: 'granted' | 'denied' | 'undetermined' | 'unavailable'
  preference: PushPreference
}): PushUiState {
  if (!input.nativeAvailable) return { status: 'unavailable', message: 'Push notifications require a physical iOS or Android development build.' }
  if (!input.memberReady) return { status: 'unavailable', message: 'Push notifications are available after your signed-in member profile is ready.' }
  if (input.bootstrapStatus === 'error') return { status: 'availability_error', message: 'Notification availability could not be checked. Please try again.' }
  if (!input.accountMatches || input.bootstrapStatus === 'idle' || input.bootstrapStatus === 'loading') return { status: 'loading', message: 'Checking notification availability.' }
  if (input.serverState === undefined) {
    return input.backendTimedOut
      ? { status: 'availability_error', message: 'Notification availability is taking too long to load. Check your connection and try again.' }
      : { status: 'loading', message: 'Checking notification availability.' }
  }
  if (input.busy) return { status: 'loading', message: input.preference.pendingDisable ? 'Turning off push notifications.' : input.preference.optedIn ? 'Updating push notifications.' : 'Enabling push notifications.' }
  if (input.preference.pendingDisable) return { status: 'pending_disable', message: 'Push was turned off on this device, but server cleanup still needs to finish.' }
  if (input.permission === 'denied') return { status: 'denied', message: 'Notifications are blocked. Open device settings to allow them.' }
  if (input.preference.optedIn && input.serverState.registered) {
    return input.serverState.available
      ? { status: 'enabled', message: 'Generic account updates may appear on this device.' }
      : { status: 'enabled', message: 'Push delivery is unavailable, but this device is still registered. You can turn it off.' }
  }
  if (!input.serverState.available) return { status: 'unavailable', message: 'Push notifications are not available in this build.' }
  if (input.failed) return { status: 'error', message: 'Push notification settings could not be updated. Please try again.' }
  return { status: 'disabled', message: 'Push notifications are off for this account on this device.' }
}

export function pushSettingsAction(status: PushUiState['status']) {
  if (status === 'availability_error') return 'retry_availability' as const
  if (status === 'disabled' || status === 'error') return 'enable' as const
  if (status === 'enabled') return 'disable' as const
  if (status === 'pending_disable') return 'retry_disable' as const
  if (status === 'denied') return 'open_settings' as const
  return 'none' as const
}

export function parsePushPayload(value: unknown): PushPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value)
  if (entries.length !== 2) return null
  const record = value as Record<string, unknown>
  if (record.version !== 1 || typeof record.notificationId !== 'string') return null
  const notificationId = record.notificationId.trim()
  if (!notificationId || notificationId.length > 200) return null
  return { version: 1, notificationId }
}

export function pushPreferenceKey(clerkUserId: string) {
  return pushSecureStorageKey('preference', clerkUserId)
}

export function pushInstallationKey() {
  return pushSecureStorageKey('installation-id')
}

export function pushInstallMarkerKey() {
  return pushSecureStorageKey('install-marker')
}

function pushSecureStorageKey(namespace: string, scope?: string) {
  const encodedScope = scope
    ? Array.from(scope, (character) => character.codePointAt(0)!.toString(16)).join('-')
    : undefined
  return ['push', namespace, encodedScope].filter(Boolean).join('.')
}

export function parsePushPreference(value: string | null): PushPreference {
  if (!value) return { optedIn: false, pendingDisable: false }
  try {
    const parsed = JSON.parse(value) as Partial<PushPreference>
    return {
      optedIn: parsed.optedIn === true,
      pendingDisable: parsed.pendingDisable === true,
    }
  } catch {
    return { optedIn: false, pendingDisable: false }
  }
}

export function serializePushPreference(value: PushPreference) {
  return JSON.stringify(value)
}

export function shouldSilentlyRefresh(input: {
  optedIn: boolean
  permissionGranted: boolean
  accountMatches: boolean
  memberReady: boolean
  backendAvailable: boolean
}) {
  return input.optedIn
    && input.permissionGranted
    && input.accountMatches
    && input.memberReady
    && input.backendAvailable
}

export function foregroundPermissionAction(input: {
  optedIn: boolean
  previousPermission: 'granted' | 'denied' | 'undetermined' | 'unavailable'
  currentPermission: 'granted' | 'denied' | 'undetermined' | 'unavailable'
  memberReady: boolean
  backendAvailable: boolean
}) {
  if (!input.optedIn || !input.memberReady) return 'none' as const
  if (input.currentPermission === 'granted' && input.backendAvailable) return 'register' as const
  if (input.currentPermission !== 'granted') return 'disable' as const
  return 'none' as const
}

export function shouldRequestPermission(input: { explicit: boolean; memberReady: boolean; backendAvailable: boolean }) {
  return input.explicit && input.memberReady && input.backendAvailable
}

export function shouldApplyBadge(unreadCount: unknown) {
  return typeof unreadCount === 'number' && Number.isSafeInteger(unreadCount) && unreadCount >= 0
}

export function responseEventKey(input: { notificationId: string; responseIdentifier?: string }) {
  return `${input.notificationId}:${input.responseIdentifier ?? 'default'}`
}

export function installationBoundary(input: {
  secureMarker: string | null
  fileMarker: string | null
  storedInstallationId: string | null
}) {
  if (input.secureMarker && input.fileMarker === input.secureMarker && input.storedInstallationId) {
    return { freshInstall: false as const, installationId: input.storedInstallationId }
  }
  return { freshInstall: true as const }
}

export function shouldRevokeOnSignOut(input: {
  optedIn: boolean
  pendingDisable: boolean
  registered: boolean
}) {
  return input.optedIn || input.pendingDisable || input.registered
}

type RevocationDependencies = {
  preference: PushPreference
  persist: (preference: PushPreference) => Promise<void>
  disableServer: () => Promise<void>
  unregisterNative: () => Promise<void>
}

export async function revokePushRegistration(input: RevocationDependencies) {
  const pending = { optedIn: input.preference.optedIn, pendingDisable: true }
  let pendingPersisted = true
  try {
    await input.persist(pending)
  } catch {
    pendingPersisted = false
  }
  await input.unregisterNative().catch(() => {})
  try {
    await input.disableServer()
  } catch {
    return { acknowledged: false as const, preference: pending }
  }
  if (!pendingPersisted) return { acknowledged: false as const, preference: pending }
  const completed = { optedIn: input.preference.optedIn, pendingDisable: false }
  try {
    await input.persist(completed)
    return { acknowledged: true as const, preference: completed }
  } catch {
    return { acknowledged: false as const, preference: pending }
  }
}

export async function resolvePushTap(input: {
  open: () => Promise<{ status: 'ready'; destination: unknown } | { status: 'unavailable' }>
  navigate: (destination: unknown) => void
}) {
  try {
    const result = await input.open()
    if (result.status === 'ready') input.navigate(result.destination)
    return { handled: true as const, terminal: result.status === 'unavailable' }
  } catch {
    return { handled: false as const, terminal: false as const }
  }
}
