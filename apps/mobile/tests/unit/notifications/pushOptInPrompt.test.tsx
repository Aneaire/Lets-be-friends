import {
  parsePushOptInPrompt,
  pushOptInPromptKey,
  serializePushOptInPrompt,
  shouldRequestPermission,
  shouldShowPushOptInPrompt,
} from '@/notifications/logic'
import { PUSH_OPT_IN_DESCRIPTION, PUSH_OPT_IN_TITLE, PushOptInPromptPresentation } from '@/notifications/PushOptInPromptPresentation'
import { runPushEnableFlow, runPushOptInAccept, runPushOptInDismiss, type PushOptInSession } from '@/notifications/pushOptInOrchestration'

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { store.set(key, value) }),
  }
})

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
    optInHandled: false,
    optInLoaded: true,
  }
}

describe('push opt-in prompt eligibility', () => {
  it('shows the prompt once the signed-in member, bootstrap, and backend are ready', () => {
    expect(shouldShowPushOptInPrompt(eligibleInput())).toBe(true)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), permission: 'granted' })).toBe(true)
  })

  it('hides the prompt after it was handled or before the handled flag loads', () => {
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), optInHandled: true })).toBe(false)
    expect(shouldShowPushOptInPrompt({ ...eligibleInput(), optInLoaded: false })).toBe(false)
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

describe('push opt-in prompt persistence', () => {
  it('scopes the handled flag to one account on one install with storage-safe keys', () => {
    const first = pushOptInPromptKey('user-a', 'install-1')
    expect(first).not.toBe(pushOptInPromptKey('user-b', 'install-1'))
    expect(first).not.toBe(pushOptInPromptKey('user-a', 'install-2'))
    expect(first).toBe(pushOptInPromptKey('user-a', 'install-1'))
    expect(first).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(pushOptInPromptKey('user:with/slash', 'install:with/slash')).toMatch(/^[A-Za-z0-9._-]+$/)
  })

  it('round-trips the handled flag and treats invalid storage as unhandled', () => {
    expect(parsePushOptInPrompt(serializePushOptInPrompt({ handled: true }))).toEqual({ handled: true })
    expect(parsePushOptInPrompt(serializePushOptInPrompt({ handled: false }))).toEqual({ handled: false })
    expect(parsePushOptInPrompt(null)).toEqual({ handled: false })
    expect(parsePushOptInPrompt('invalid')).toEqual({ handled: false })
    expect(parsePushOptInPrompt(JSON.stringify({ handled: 'yes' }))).toEqual({ handled: false })
  })

  it('treats each installation key independently so reinstalls prompt again', () => {
    expect(pushOptInPromptKey('user-a', 'install-1')).not.toBe(pushOptInPromptKey('user-a', 'install-2'))
  })

  it('persists handled state across relaunch and sign-out via the native store', async () => {
    const secureStore = require('expo-secure-store') as {
      getItemAsync: jest.Mock
      setItemAsync: jest.Mock
      __store: Map<string, string>
    }
    secureStore.__store.clear()
    secureStore.getItemAsync.mockClear()
    secureStore.setItemAsync.mockClear()
    const { readPushOptInPrompt, writePushOptInPrompt } = require('@/notifications/preferences.native') as typeof import('@/notifications/preferences.native')

    expect(await readPushOptInPrompt('user-a', 'install-1')).toEqual({ handled: false })
    await writePushOptInPrompt('user-a', 'install-1', { handled: true })
    expect(await readPushOptInPrompt('user-a', 'install-1')).toEqual({ handled: true })
    expect(await readPushOptInPrompt('user-a', 'install-2')).toEqual({ handled: false })
    expect(await readPushOptInPrompt('user-b', 'install-1')).toEqual({ handled: false })

    secureStore.setItemAsync.mockClear()
    await writePushOptInPrompt('user-a', '', { handled: true })
    expect(secureStore.setItemAsync).not.toHaveBeenCalled()
    expect(await readPushOptInPrompt('user-a', '')).toEqual({ handled: false })
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
    const persistHandled = jest.fn(async () => undefined)
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
      persistHandled,
      onHidden,
    })

    await permissionRequested.promise
    controller.switchAccount({ accountId: 'user-b', installationId: 'install-1', generation: 2 })
    permissionGate.resolve('granted')
    await expect(flow).resolves.toBe('stale')
    expect(registerOnServer).not.toHaveBeenCalled()
    expect(saveOptedInPreference).not.toHaveBeenCalled()
    expect(persistHandled).not.toHaveBeenCalled()
    expect(onHidden).not.toHaveBeenCalled()
  })

  it('suppresses server writes after unmount even when the same account signs back in', async () => {
    const sessionA: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 5 }
    const controller = liveSessionController(sessionA)
    const permissionGate = deferred<'granted' | 'denied' | 'undetermined' | 'unavailable'>()
    const permissionRequested = deferred<void>()
    const registerOnServer = jest.fn(async () => undefined)
    const persistHandled = jest.fn(async () => undefined)

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
      persistHandled,
      onHidden: () => undefined,
    })

    await permissionRequested.promise
    controller.unmount()
    controller.switchAccount({ accountId: 'user-a', installationId: 'install-1', generation: 6 })
    permissionGate.resolve('granted')
    await expect(flow).resolves.toBe('stale')
    expect(registerOnServer).not.toHaveBeenCalled()
    expect(persistHandled).not.toHaveBeenCalled()
  })

  it('retries successfully with the new session after a stale abort', async () => {
    const controller = liveSessionController({ accountId: 'user-a', installationId: 'install-1', generation: 1 })
    const registerOnServer = jest.fn(async () => undefined)
    const saveOptedInPreference = jest.fn(async () => undefined)
    const persistHandled = jest.fn(async () => undefined)
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
      persistHandled,
      onHidden: () => { hidden.push('hidden') },
    })).resolves.toBe('registered')
    expect(registerOnServer).toHaveBeenCalledTimes(1)
    expect(saveOptedInPreference).toHaveBeenCalledTimes(1)
    expect(persistHandled).toHaveBeenCalledTimes(1)
    expect(hidden).toEqual(['hidden'])
  })

  it('keeps failed registration retryable without persisting a successful opt-in', async () => {
    const session: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 1 }
    const controller = liveSessionController(session)
    const registerOnServer = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const saveOptedInPreference = jest.fn(async () => undefined)
    const persistHandled = jest.fn(async () => undefined)
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
      session, isCurrent: controller.isCurrent, runEnable: enable, persistHandled, onHidden,
    })

    await expect(accept()).resolves.toBe('failed')
    expect(onFailure).toHaveBeenCalledWith(true)
    expect(saveOptedInPreference).not.toHaveBeenCalled()
    expect(persistHandled).not.toHaveBeenCalled()
    expect(onHidden).not.toHaveBeenCalled()
    await expect(accept()).resolves.toBe('registered')
    expect(saveOptedInPreference).toHaveBeenCalledTimes(1)
    expect(persistHandled).toHaveBeenCalledTimes(1)
    expect(onHidden).toHaveBeenCalledTimes(1)
  })

  it('hides Not now promptly before storage settles and tolerates storage failure', async () => {
    const session: PushOptInSession = { accountId: 'user-a', installationId: 'install-1', generation: 1 }
    const controller = liveSessionController(session)
    const order: string[] = []
    const persistGate = deferred<void>()
    const hidden: string[] = []

    const pending = runPushOptInDismiss({
      session,
      isCurrent: controller.isCurrent,
      persistHandled: async () => {
        order.push('persist-start')
        await persistGate.promise
        order.push('persist-end')
      },
      onHidden: () => {
        order.push('hidden')
        hidden.push('hidden')
      },
    })
    await Promise.resolve()
    expect(order).toEqual(['hidden', 'persist-start'])
    expect(hidden).toEqual(['hidden'])
    persistGate.resolve()
    await expect(pending).resolves.toBe('hidden')

    const failedHidden: string[] = []
    await expect(runPushOptInDismiss({
      session,
      isCurrent: controller.isCurrent,
      persistHandled: async () => { throw new Error('secure store unavailable') },
      onHidden: () => { failedHidden.push('hidden') },
    })).resolves.toBe('hidden')
    expect(failedHidden).toEqual(['hidden'])
  })
})
