import type { NativePermissionState, NativePushRegistration } from './nativeAdapter'
import type { PushRegistrationCandidate } from './logic'

export type PushOptInSession = {
  accountId: string
  installationId: string
  generation: number
}

export type PushEnableFlowDeps = {
  session: PushOptInSession
  isCurrent: (session: PushOptInSession) => boolean
  memberReady: boolean
  backendAvailable: boolean
  pendingDisable: boolean
  getPermissionState: () => Promise<NativePermissionState>
  ensureNotificationChannel: () => Promise<void>
  requestPermission: () => Promise<NativePermissionState>
  getRegistration: () => Promise<NativePushRegistration | null>
  getInstallationId: () => Promise<string>
  registerOnServer: (candidate: PushRegistrationCandidate) => Promise<unknown>
  saveOptedInPreference: () => Promise<void>
  onPermissionState: (state: NativePermissionState) => void
  onFailure: (failed: boolean) => void
}

export type PushEnableFlowOutcome = 'registered' | 'denied' | 'failed' | 'stale' | 'ineligible'

export async function runPushEnableFlow(deps: PushEnableFlowDeps): Promise<PushEnableFlowOutcome> {
  if (deps.pendingDisable || !deps.memberReady || !deps.backendAvailable) return 'ineligible'
  if (!deps.isCurrent(deps.session)) return 'stale'
  let current: NativePermissionState
  try {
    current = await deps.getPermissionState()
  } catch {
    if (!deps.isCurrent(deps.session)) return 'stale'
    deps.onFailure(true)
    return 'failed'
  }
  if (!deps.isCurrent(deps.session)) return 'stale'
  if (current === 'denied') {
    deps.onPermissionState('denied')
    return 'denied'
  }
  try {
    await deps.ensureNotificationChannel()
  } catch {
    if (!deps.isCurrent(deps.session)) return 'stale'
    deps.onFailure(true)
    return 'failed'
  }
  if (!deps.isCurrent(deps.session)) return 'stale'
  let next: NativePermissionState = current
  if (current !== 'granted') {
    try {
      next = await deps.requestPermission()
    } catch {
      if (!deps.isCurrent(deps.session)) return 'stale'
      deps.onFailure(true)
      return 'failed'
    }
    if (!deps.isCurrent(deps.session)) return 'stale'
    deps.onPermissionState(next)
    if (!deps.isCurrent(deps.session)) return 'stale'
  }
  if (next !== 'granted') {
    deps.onFailure(false)
    return 'failed'
  }
  let registration: NativePushRegistration | null
  try {
    registration = await deps.getRegistration()
  } catch {
    if (!deps.isCurrent(deps.session)) return 'stale'
    deps.onFailure(true)
    return 'failed'
  }
  if (!deps.isCurrent(deps.session)) return 'stale'
  if (!registration) {
    deps.onFailure(true)
    return 'failed'
  }
  let resolvedInstallationId: string
  try {
    resolvedInstallationId = await deps.getInstallationId()
  } catch {
    if (!deps.isCurrent(deps.session)) return 'stale'
    deps.onFailure(true)
    return 'failed'
  }
  if (!deps.isCurrent(deps.session)) return 'stale'
  try {
    await deps.registerOnServer({ installationId: resolvedInstallationId, ...registration })
  } catch {
    if (!deps.isCurrent(deps.session)) return 'stale'
    deps.onFailure(true)
    return 'failed'
  }
  if (!deps.isCurrent(deps.session)) return 'stale'
  try {
    await deps.saveOptedInPreference()
  } catch {
    if (!deps.isCurrent(deps.session)) return 'stale'
    deps.onFailure(true)
    return 'failed'
  }
  if (!deps.isCurrent(deps.session)) return 'stale'
  return 'registered'
}

export type PushOptInAcceptDeps = {
  session: PushOptInSession
  isCurrent: (session: PushOptInSession) => boolean
  runEnable: () => Promise<PushEnableFlowOutcome>
  onHidden: () => void
}

export async function runPushOptInAccept(deps: PushOptInAcceptDeps): Promise<PushEnableFlowOutcome> {
  if (!deps.isCurrent(deps.session)) return 'stale'
  const outcome = await deps.runEnable()
  if (outcome !== 'registered') return outcome
  if (!deps.isCurrent(deps.session)) return 'stale'
  deps.onHidden()
  return 'registered'
}

export type PushOptInDismissDeps = {
  session: PushOptInSession
  isCurrent: (session: PushOptInSession) => boolean
  onHidden: () => void
}

export async function runPushOptInDismiss(deps: PushOptInDismissDeps): Promise<'hidden' | 'stale'> {
  if (!deps.isCurrent(deps.session)) return 'stale'
  deps.onHidden()
  return 'hidden'
}
