export type PushPayload = { version: 1; notificationId: string }

export type PushPreference = {
  optedIn: boolean
  pendingDisable: boolean
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
  return `push:preference:${clerkUserId}`
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
