import {
  shouldRequestPermission,
  shouldShowPushOptInPrompt,
} from '@/notifications/logic'
import { PUSH_OPT_IN_DESCRIPTION, PUSH_OPT_IN_TITLE, PushOptInPromptPresentation } from '@/notifications/PushOptInPromptPresentation'
import { runPushEnableFlow, runPushOptInAccept, runPushOptInDismiss, type PushOptInSession } from '@/notifications/pushOptInOrchestration'

function eligibleInput() {
  return {
    nativeAvailable: true,
    memberReady: true,
    bootstrapStatus: 'ready' as const,
    accountMatches: true,
    backendAvailable: true,
    backendRegistered: false,
    optedIn: false,
    pendingDisable: false,
    permission: 'undetermined' as const,
    dismissedThisSession: false,
  }
}

describe('push opt-in prompt eligibility', () => {
  it('shows the prompt once the signed-in member, bootstrap, and backend are ready', () => {
    expect(shouldShowPushOptInPrompt(eligibleInput())).toBe(true)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), permission: 'granted' })).toBe(true)
  })

  it('hides the prompt for the rest of the session after Not now, then asks again next session', () => {
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), dismissedThisSession: true })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), dismissedThisSession: false })).toBe(true)
  })

  it('excludes opted-in, pending disable, denied permission, and unavailable backends or platforms', () => {
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), optedIn: true })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), pendingDisable: true })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), permission: 'denied' })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), permission: 'unavailable' })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), nativeAvailable: false })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), backendAvailable: false })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), backendRegistered: true })).toBe(false)
  })

  it('waits for the matching account bootstrap instead of prompting early', () => {
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), memberReady: false })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), accountMatches: false })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), bootstrapStatus: 'loading' })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), bootstrapStatus: 'idle' })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), bootstrapStatus: 'error' })).toBe(false)
  })

  it('never authorizes an OS permission request without an explicit enable action', () => {
    expect(shouldRequestPermission({ explicit: false, memberReady: true, backendAvailable: true })).toBe(false)
    expect(shouldRequestPermission({ explicit: true, memberReady: true, backendAvailable: true })).toBe(true)
  })
})

describe('push opt-in prompt actions', () => {
  it('offers explicit enable and not-now actions with account-safe copy', () => {
    const onEnable = jest.fn()
    const onDismiss = jest.fn()
    const element = PushOptInPromptPresentation({ onEnable, onDismiss }) as unknown as {
      props: {
        title: string
        description: string
        confirmLabel: string
        cancelLabel: string
        intent: string
        onConfirm: () => void
        onClose: () => void
      }
    }

    expect(element.props.title).toBe(PUSH_OPT_IN_TITLE)
    expect(element.props.description).toBe(PUSH_OPT_IN_DESCRIPTION)
    expect(element.props.confirmLabel).toBe('Enable notifications')
    expect(element.props.cancelLabel).toBe('Not now')
    expect(element.props.intent).toBe('self')
    expect(PUSH_OPT_IN_TITLE).not.toContain('—')
    expect(PUSH_OPT_IN_DESCRIPTION).not.toContain('—')

    element.props.onConfirm()
    expect(onEnable).toHaveBeenCalledTimes(1)
    element.props.onClose()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps the enable action retryable after a failure and hides the error while busy', () => {
    const failed = PushOptInPromptPresentation({ onEnable: jest.fn(), onDismiss: jest.fn(), failed: true }) as unknown as {
      props: { confirmLabel: string; busy: boolean; children: unknown }
    }
    expect(failed.props.confirmLabel).toBe('Enable notifications')
    expect(failed.props.children).not.toBeNull()

    const busyFailed = PushOptInPromptPresentation({ onEnable: jest.fn(), onDismiss: jest.fn(), failed: true, busy: true }) as unknown as {
      props: { busy: boolean; children: unknown }
    }
    expect(busyFailed.props.busy).toBe(true)
    expect(busyFailed.props.children).toBeNull()
  })


})

describe('push opt-in orchestration session safety', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  function liveSessionController(initial: PushOptInSession) {
    let live = { ...initial }
    let mounted = true
    return {
      get liveSession() { return { ...live } },
      isCurrent: (session: PushOptInSession) => mounted
        && live.generation === session.generation
        && live.accountId === session.accountId
        && live.installationId === session.installationId,
      switchAccount: (next: PushOptInSession) => { live = { ...next } },
      unmount: () => { mounted = false },
    }
  }

  it('aborts a pending enable when the account switches or unmounts before the OS dialog resolves', async () => {
    const sessionA: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 1 }
    const controller = liveSessionController(sessionA)
    const permissionGate = deferred<'granted' | 'denied' | 'undetermined' | 'unavailable'>()
    const permissionRequested = deferred<void>()
    const registerOnServer = jest.fn(async () => undefined)
    const saveOptedInPreference = jest.fn(async () => undefined)
    const onHidden = jest.fn()
    const onPermissionState = jest.fn()
    const onFailure = jest.fn()

    const flow = runPushOptInAccept({
      session: sessionA,
      isCurrent: controller.isCurrent,
      runEnable: () => runPushEnableFlow({
        session: sessionA,
        isCurrent: controller.isCurrent,
        memberReady: true,
        backendAvailable: true,
        pendingDisable: false,
        getPermissionState: async () => 'undetermined',
        ensureNotificationChannel: async () => undefined,
        requestPermission: () => { permissionRequested.resolve(); return permissionGate.promise },
        getRegistration: async () => ({ expoPushToken: 'token', projectId: 'project', platform: 'android' as const }),
        getInstallationId: async () => 'install-1',
        registerOnServer,
        saveOptedInPreference,
        onPermissionState,
        onFailure,
      }),
      onHidden,
    })

    await permissionRequested.promise
    controller.switchAccount({ accountId: 'user-b', installationId: 'install-1', generation: 2 })
    permissionGate.resolve('granted')
    await expect(flow).resolves.toBe('stale')
    expect(registerOnServer).not.toHaveBeenCalled()
    expect(saveOptedInPreference).not.toHaveBeenCalled()
    expect(onHidden).not.toHaveBeenCalled()
  })

  it('suppresses server writes after unmount even when the same account signs back in', async () => {
    const sessionA: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 5 }
    const controller = liveSessionController(sessionA)
    const permissionGate = deferred<'granted' | 'denied' | 'undetermined' | 'unavailable'>()
    const permissionRequested = deferred<void>()
    const registerOnServer = jest.fn(async () => undefined)

    const flow = runPushOptInAccept({
      session: sessionA,
      isCurrent: controller.isCurrent,
      runEnable: () => runPushEnableFlow({
        session: sessionA,
        isCurrent: controller.isCurrent,
        memberReady: true,
        backendAvailable: true,
        pendingDisable: false,
        getPermissionState: async () => 'undetermined',
        ensureNotificationChannel: async () => undefined,
        requestPermission: () => { permissionRequested.resolve(); return permissionGate.promise },
        getRegistration: async () => ({ expoPushToken: 'token', projectId: 'project', platform: 'ios' as const }),
        getInstallationId: async () => 'install-1',
        registerOnServer,
        saveOptedInPreference: async () => undefined,
        onPermissionState: () => undefined,
        onFailure: () => undefined,
      }),
      onHidden: () => undefined,
    })

    await permissionRequested.promise
    controller.unmount()
    controller.switchAccount({ accountId: 'user-a', installationId: 'install-1', generation: 6 })
    permissionGate.resolve('granted')
    await expect(flow).resolves.toBe('stale')
    expect(registerOnServer).not.toHaveBeenCalled()
  })

  it('retries successfully with the new session after a stale abort', async () => {
    const controller = liveSessionController({ accountId: 'user-a', installationId: 'install-1', generation: 1 })
    const registerOnServer = jest.fn(async () => undefined)
    const saveOptedInPreference = jest.fn(async () => undefined)
    const hidden: string[] = []

    const staleSession: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 1 }
    controller.switchAccount({ accountId: 'user-b', installationId: 'install-1', generation: 2 })
    await expect(runPushEnableFlow({
      session: staleSession,
      isCurrent: controller.isCurrent,
      memberReady: true,
      backendAvailable: true,
      pendingDisable: false,
      getPermissionState: async () => 'granted',
      ensureNotificationChannel: async () => undefined,
      requestPermission: async () => 'granted',
      getRegistration: async () => ({ expoPushToken: 'token', projectId: 'project', platform: 'android' as const }),
      getInstallationId: async () => 'install-1',
      registerOnServer,
      saveOptedInPreference,
      onPermissionState: () => undefined,
      onFailure: () => undefined,
    })).resolves.toBe('stale')
    expect(registerOnServer).not.toHaveBeenCalled()

    const sessionB: PushOptInSession = { accountId: 'user-b', installationId: 'install-1', generation: 2 }
    await expect(runPushOptInAccept({
      session: sessionB,
      isCurrent: controller.isCurrent,
      runEnable: () => runPushEnableFlow({
        session: sessionB,
        isCurrent: controller.isCurrent,
        memberReady: true,
        backendAvailable: true,
        pendingDisable: false,
        getPermissionState: async () => 'granted',
        ensureNotificationChannel: async () => undefined,
        requestPermission: async () => 'granted',
        getRegistration: async () => ({ expoPushToken: 'token', projectId: 'project', platform: 'android' as const }),
        getInstallationId: async () => 'install-1',
        registerOnServer,
        saveOptedInPreference,
        onPermissionState: () => undefined,
        onFailure: () => undefined,
      }),
      onHidden: () => { hidden.push('hidden') },
    })).resolves.toBe('registered')
    expect(registerOnServer).toHaveBeenCalledTimes(1)
    expect(saveOptedInPreference).toHaveBeenCalledTimes(1)
    expect(hidden).toEqual(['hidden'])
  })

  it('keeps failed registration retryable until registration succeeds', async () => {
    const session: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 1 }
    const controller = liveSessionController(session)
    const registerOnServer = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const saveOptedInPreference = jest.fn(async () => undefined)
    const onHidden = jest.fn()
    const onFailure = jest.fn()
    const enable = () => runPushEnableFlow({
      session,
      isCurrent: controller.isCurrent,
      memberReady: true,
      backendAvailable: true,
      pendingDisable: false,
      getPermissionState: async () => 'granted',
      ensureNotificationChannel: async () => undefined,
      requestPermission: async () => 'granted',
      getRegistration: async () => ({ expoPushToken: 'token', projectId: 'project', platform: 'android' as const }),
      getInstallationId: async () => 'install-1',
      registerOnServer,
      saveOptedInPreference,
      onPermissionState: () => undefined,
      onFailure,
    })
    const accept = () => runPushOptInAccept({
      session, isCurrent: controller.isCurrent, runEnable: enable, onHidden,
    })

    await expect(accept()).resolves.toBe('failed')
    expect(onFailure).toHaveBeenCalledWith(true)
    expect(saveOptedInPreference).not.toHaveBeenCalled()
    expect(onHidden).not.toHaveBeenCalled()
    await expect(accept()).resolves.toBe('registered')
    expect(saveOptedInPreference).toHaveBeenCalledTimes(1)
    expect(onHidden).toHaveBeenCalledTimes(1)
  })

  it('hides Not now for the current session and ignores a stale session', async () => {
    const session: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 1 }
    const controller = liveSessionController(session)
    const hidden: string[] = []

    await expect(runPushOptInDismiss({
      session,
      isCurrent: controller.isCurrent,
      onHidden: () => { hidden.push('hidden') },
    })).resolves.toBe('hidden')
    expect(hidden).toEqual(['hidden'])

    controller.switchAccount({ accountId: 'user-b', installationId: 'install-1', generation: 2 })
    const staleHidden: string[] = []
    await expect(runPushOptInDismiss({
      session,
      isCurrent: controller.isCurrent,
      onHidden: () => { staleHidden.push('hidden') },
    })).resolves.toBe('stale')
    expect(staleHidden).toEqual([])
  })
})
