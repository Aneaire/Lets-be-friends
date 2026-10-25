import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { registerSignOutCleanup, useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi } from '@/backend/client'
import { mobileNotificationRoute, type MobileNotificationDestination } from '@/data/notifications'
import { useMobileMember } from '@/member/MobileMember'

import { createPushRegistrationCoordinator, foregroundPermissionAction, parsePushPayload, resolvePushTap, resolvePushUiState, responseEventKey, revokePushRegistration, shouldApplyBadge, shouldRequestPermission, shouldRevokeOnSignOut, shouldShowPushOptInPrompt, shouldSilentlyRefresh, type PushPreference, type PushUiState } from './logic'
import { nativePushAdapter } from './nativeAdapter'
import { readPushOptInPrompt, readPushPreference, writePushOptInPrompt, writePushPreference } from './preferences'
import { runPushEnableFlow, runPushOptInAccept, runPushOptInDismiss, type PushOptInSession } from './pushOptInOrchestration'
import { PushOptInPrompt } from './PushOptInPromptPresentation'

type PushContextValue = {
  state: PushUiState
  enable: () => Promise<void>
  disable: () => Promise<void>
  openSettings: () => Promise<void>
  retryDisable: () => Promise<void>
  retryAvailability: () => Promise<void>
  cleanupForSignOut: () => Promise<void>
  optInVisible: boolean
  acceptOptIn: () => Promise<void>
  dismissOptIn: () => Promise<void>
}

const PushContext = createContext<PushContextValue>({
  state: { status: 'unavailable', message: 'Push notifications are unavailable.' },
  enable: async () => {},
  disable: async () => {},
  openSettings: async () => {},
  retryDisable: async () => {},
  retryAvailability: async () => {},
  cleanupForSignOut: async () => {},
  optInVisible: false,
  acceptOptIn: async () => {},
  dismissOptIn: async () => {},
})

export function PushNotificationsProvider({ children }: PropsWithChildren) {
  const auth = useMobileAuth()
  const member = useMobileMember()
  const ready = auth.status === 'signed_in' && member.status === 'ready'
  const [installationId, setInstallationId] = useState<string | null>(null)
  const serverState = useQuery(mobileApi.pushNotifications.state, ready && installationId ? { installationId } : 'skip')
  const unreadCount = useQuery(mobileApi.notifications.unreadCount, ready ? {} : 'skip')
  const registerDevice = useMutation(mobileApi.pushNotifications.registerDevice)
  const disableDevice = useMutation(mobileApi.pushNotifications.disableDevice)
  const openNotification = useMutation(mobileApi.notifications.open)
  const accountId = auth.status === 'signed_in' ? auth.clerkUserId : null
  const [preference, setPreference] = useState<PushPreference>({ optedIn: false, pendingDisable: false })
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined' | 'unavailable'>('unavailable')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [bootstrap, setBootstrap] = useState<{ accountId: string | null; status: 'idle' | 'loading' | 'ready' | 'error' }>({ accountId: null, status: 'idle' })
  const [backendTimedOut, setBackendTimedOut] = useState(false)
  const [optInHandled, setOptInHandled] = useState(false)
  const [optInLoaded, setOptInLoaded] = useState(false)
  const bootstrapGeneration = useRef(0)
  const optInGeneration = useRef(0)
  const sessionGeneration = useRef(0)
  const mountedRef = useRef(true)
  const liveAccountRef = useRef<string | null>(null)
  const liveInstallationRef = useRef<string | null>(null)
  const optInActionRef = useRef(false)
  const loadedAccount = useRef<string | null>(null)
  const optInLoadedKey = useRef<string | null>(null)
  const launchRetryAccount = useRef<string | null>(null)
  const handledResponses = useRef(new Set<string>())
  const pendingResponse = useRef<{ data: unknown; responseIdentifier?: string } | null>(null)
  const registrationCoordinator = useMemo(createPushRegistrationCoordinator, [])

  const bootstrapAccount = useCallback(async (targetAccountId: string) => {
    const generation = ++bootstrapGeneration.current
    loadedAccount.current = null
    launchRetryAccount.current = null
    optInLoadedKey.current = null
    setPreference({ optedIn: false, pendingDisable: false })
    setPermission('unavailable')
    setInstallationId(null)
    setFailed(false)
    setBackendTimedOut(false)
    setOptInHandled(false)
    setOptInLoaded(false)
    setBootstrap({ accountId: targetAccountId, status: 'loading' })
    try {
      const [saved, currentPermission, installation] = await Promise.all([
        readPushPreference(targetAccountId),
        nativePushAdapter.getPermissionState(),
        nativePushAdapter.available ? nativePushAdapter.ensureInstallation() : Promise.resolve(null),
      ])
      if (bootstrapGeneration.current !== generation) return
      const currentPreference = installation?.freshInstall
        ? { optedIn: false, pendingDisable: false }
        : saved
      if (installation?.freshInstall) {
        void nativePushAdapter.unregister().catch(() => {})
        await writePushPreference(targetAccountId, currentPreference)
      }
      if (bootstrapGeneration.current !== generation) return
      loadedAccount.current = targetAccountId
      setPreference(currentPreference)
      setPermission(currentPermission)
      setInstallationId(installation?.installationId ?? null)
      setBootstrap({ accountId: targetAccountId, status: 'ready' })
    } catch {
      if (bootstrapGeneration.current === generation) setBootstrap({ accountId: targetAccountId, status: 'error' })
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sessionGeneration.current += 1
      bootstrapGeneration.current += 1
      optInGeneration.current += 1
      loadedAccount.current = null
      optInLoadedKey.current = null
    }
  }, [])

  useEffect(() => {
    liveAccountRef.current = accountId
    liveInstallationRef.current = installationId
  }, [accountId, installationId])

  const captureOptInSession = useCallback((): PushOptInSession | null => {
    const currentAccount = liveAccountRef.current
    const currentInstallation = liveInstallationRef.current
    if (!currentAccount || !currentInstallation) return null
    return { accountId: currentAccount, installationId: currentInstallation, generation: sessionGeneration.current }
  }, [])

  const isCurrentOptInSession = useCallback((session: PushOptInSession) => {
    if (!mountedRef.current) return false
    const live = { accountId: liveAccountRef.current, installationId: liveInstallationRef.current, generation: sessionGeneration.current }
    return live.generation === session.generation
      && live.accountId === session.accountId
      && live.installationId === session.installationId
      && loadedAccount.current === session.accountId
  }, [])

  useEffect(() => {
    sessionGeneration.current += 1
    bootstrapGeneration.current += 1
    optInGeneration.current += 1
    loadedAccount.current = null
    optInLoadedKey.current = null
    optInActionRef.current = false
    setBootstrap({ accountId, status: accountId ? 'loading' : 'idle' })
    if (accountId) void bootstrapAccount(accountId)
    else {
      launchRetryAccount.current = null
      setPreference({ optedIn: false, pendingDisable: false })
      setPermission('unavailable')
      setInstallationId(null)
      setFailed(false)
      setBackendTimedOut(false)
      setOptInHandled(false)
      setOptInLoaded(false)
    }
    return () => {
      bootstrapGeneration.current += 1
      optInGeneration.current += 1
      sessionGeneration.current += 1
      loadedAccount.current = null
      optInLoadedKey.current = null
      optInActionRef.current = false
    }
  }, [accountId, bootstrapAccount])

  useEffect(() => {
    if (!ready || bootstrap.status !== 'ready' || bootstrap.accountId !== accountId || !installationId || serverState !== undefined) {
      setBackendTimedOut(false)
      return
    }
    const timeout = setTimeout(() => setBackendTimedOut(true), 8_000)
    return () => clearTimeout(timeout)
  }, [accountId, bootstrap.accountId, bootstrap.status, installationId, ready, serverState])

  const retryAvailability = useCallback(async () => {
    if (!accountId) return
    await bootstrapAccount(accountId)
  }, [accountId, bootstrapAccount])

  useEffect(() => {
    if (!accountId || !installationId || bootstrap.status !== 'ready' || bootstrap.accountId !== accountId || loadedAccount.current !== accountId) return
    const loadKey = `${accountId}:${installationId}`
    if (optInLoadedKey.current === loadKey) return
    const generation = ++optInGeneration.current
    let cancelled = false
    void readPushOptInPrompt(accountId, installationId).then((saved) => {
      if (cancelled || optInGeneration.current !== generation) return
      if (loadedAccount.current !== accountId) return
      optInLoadedKey.current = loadKey
      setOptInHandled(saved.handled)
      setOptInLoaded(true)
    }).catch(() => {
      if (cancelled || optInGeneration.current !== generation) return
      if (loadedAccount.current !== accountId) return
      optInLoadedKey.current = loadKey
      setOptInHandled(false)
      setOptInLoaded(true)
    })
    return () => { cancelled = true }
  }, [accountId, bootstrap.accountId, bootstrap.status, installationId])

  const currentInstallationId = useCallback(async () => {
    if (liveInstallationRef.current) return liveInstallationRef.current
    if (!mountedRef.current) throw new Error('Push provider unmounted')
    const generation = sessionGeneration.current
    const installation = await nativePushAdapter.ensureInstallation()
    if (!mountedRef.current || sessionGeneration.current !== generation) throw new Error('Push session changed')
    setInstallationId(installation.installationId)
    liveInstallationRef.current = installation.installationId
    return installation.installationId
  }, [])

  const registerCurrentDevice = useCallback(async () => {
    const liveAccount = liveAccountRef.current
    const liveGeneration = sessionGeneration.current
    if (!liveAccount || !mountedRef.current) return false
    if (!ready || !nativePushAdapter.available || serverState?.available !== true || preference.pendingDisable) return false
    if (loadedAccount.current !== liveAccount) return false
    return registrationCoordinator.register(
      liveAccount,
      async () => {
        if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) return null
        const registration = await nativePushAdapter.getRegistration()
        if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) return null
        if (!registration) return null
        const currentId = await currentInstallationId()
        if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) return null
        return { installationId: currentId, ...registration }
      },
      async (candidate) => {
        if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) throw new Error('Push session changed')
        await registerDevice(candidate)
        if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) throw new Error('Push session changed')
        const next = { optedIn: true, pendingDisable: false }
        await writePushPreference(liveAccount, next)
        if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) return
        setPreference(next)
        setPermission('granted')
      },
    )
  }, [currentInstallationId, preference.pendingDisable, ready, registerDevice, registrationCoordinator, serverState?.available])

  const revoke = useCallback(async (nextOptedIn: boolean) => {
    if (!accountId) {
      await nativePushAdapter.unregister().catch(() => {})
      return false
    }
    registrationCoordinator.reset(accountId)
    const result = await revokePushRegistration({
      preference: { optedIn: nextOptedIn, pendingDisable: true },
      persist: async (next) => {
        setPreference(next)
        await writePushPreference(accountId, next)
      },
      unregisterNative: () => nativePushAdapter.unregister(),
      disableServer: async () => {
        if (!ready) throw new Error('Member unavailable')
        const currentId = await currentInstallationId()
        await disableDevice({ installationId: currentId })
      },
    })
    setPreference(result.preference)
    return result.acknowledged
  }, [accountId, currentInstallationId, disableDevice, ready, registrationCoordinator])

  const disable = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    try {
      const acknowledged = await revoke(false)
      setFailed(!acknowledged)
    } catch {
      setPreference({ optedIn: false, pendingDisable: true })
      setFailed(true)
    } finally {
      await nativePushAdapter.setBadgeCount(0).catch(() => {})
      setBusy(false)
    }
  }, [revoke])

  const retryDisable = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    try {
      const acknowledged = await revoke(preference.optedIn)
      setFailed(!acknowledged)
    } catch {
      setPreference({ optedIn: preference.optedIn, pendingDisable: true })
      setFailed(true)
    } finally {
      await nativePushAdapter.setBadgeCount(0).catch(() => {})
      setBusy(false)
    }
  }, [preference.optedIn, revoke])

  const cleanupForSignOut = useCallback(async () => {
    const shouldDisableServer = Boolean(accountId && shouldRevokeOnSignOut({
      optedIn: preference.optedIn,
      pendingDisable: preference.pendingDisable,
      registered: serverState?.registered === true,
    }))
    if (shouldDisableServer) await revoke(preference.optedIn).catch(() => {})
    else await nativePushAdapter.unregister().catch(() => {})
    await nativePushAdapter.setBadgeCount(0).catch(() => {})
  }, [accountId, preference.optedIn, preference.pendingDisable, revoke, serverState?.registered])

  const tryEnable = useCallback(async () => {
    if (optInActionRef.current) return false
    const session = captureOptInSession()
    if (!session || !isCurrentOptInSession(session)) return false
    if (preference.pendingDisable || !shouldRequestPermission({ explicit: true, memberReady: ready, backendAvailable: serverState?.available === true })) return false
    optInActionRef.current = true
    setBusy(true)
    setFailed(false)
    try {
      const outcome = await runPushEnableFlow({
        session,
        isCurrent: isCurrentOptInSession,
        memberReady: ready,
        backendAvailable: serverState?.available === true,
        pendingDisable: preference.pendingDisable,
        getPermissionState: () => nativePushAdapter.getPermissionState(),
        ensureNotificationChannel: () => nativePushAdapter.ensureNotificationChannel(),
        requestPermission: () => nativePushAdapter.requestPermission(),
        getRegistration: () => nativePushAdapter.getRegistration(),
        getInstallationId: () => currentInstallationId(),
        registerOnServer: (candidate) => registerDevice(candidate),
        saveOptedInPreference: async () => {
          const next = { optedIn: true, pendingDisable: false }
          await writePushPreference(session.accountId, next)
          if (!isCurrentOptInSession(session)) return
          setPreference(next)
          setPermission('granted')
        },
        onPermissionState: (nextPermission) => {
          if (!isCurrentOptInSession(session)) return
          setPermission(nextPermission)
        },
        onFailure: (failed) => {
          if (!isCurrentOptInSession(session)) return
          setFailed(failed)
        },
      })
      return outcome === 'registered'
    } catch {
      if (isCurrentOptInSession(session)) setFailed(true)
      return false
    } finally {
      optInActionRef.current = false
      if (isCurrentOptInSession(session)) setBusy(false)
      else if (mountedRef.current) setBusy(false)
    }
  }, [captureOptInSession, currentInstallationId, isCurrentOptInSession, preference.pendingDisable, ready, registerDevice, serverState?.available])

  const enable = useCallback(async () => {
    await tryEnable()
  }, [tryEnable])

  const markOptInHandled = useCallback(async (session: PushOptInSession) => {
    try {
      await writePushOptInPrompt(session.accountId, session.installationId, { handled: true })
    } catch {
      // Best effort. The in-memory flag still hides the prompt for this session.
    }
  }, [])

  const dismissOptIn = useCallback(async () => {
    if (optInActionRef.current) return
    const session = captureOptInSession()
    if (!session || !isCurrentOptInSession(session)) return
    optInActionRef.current = true
    try {
      await runPushOptInDismiss({
        session,
        isCurrent: isCurrentOptInSession,
        persistHandled: () => markOptInHandled(session),
        onHidden: () => {
          if (!isCurrentOptInSession(session)) return
          optInLoadedKey.current = `${session.accountId}:${session.installationId}`
          setOptInHandled(true)
          setOptInLoaded(true)
        },
      })
    } finally {
      optInActionRef.current = false
    }
  }, [captureOptInSession, isCurrentOptInSession, markOptInHandled])

  const acceptOptIn = useCallback(async () => {
    if (optInActionRef.current) return
    const session = captureOptInSession()
    if (!session || !isCurrentOptInSession(session)) return
    optInActionRef.current = true
    setBusy(true)
    setFailed(false)
    try {
      const outcome = await runPushOptInAccept({
        session,
        isCurrent: isCurrentOptInSession,
        runEnable: () => runPushEnableFlow({
          session,
          isCurrent: isCurrentOptInSession,
          memberReady: ready,
          backendAvailable: serverState?.available === true,
          pendingDisable: preference.pendingDisable,
          getPermissionState: () => nativePushAdapter.getPermissionState(),
          ensureNotificationChannel: () => nativePushAdapter.ensureNotificationChannel(),
          requestPermission: () => nativePushAdapter.requestPermission(),
          getRegistration: () => nativePushAdapter.getRegistration(),
          getInstallationId: () => currentInstallationId(),
          registerOnServer: (candidate) => registerDevice(candidate),
          saveOptedInPreference: async () => {
            const next = { optedIn: true, pendingDisable: false }
            await writePushPreference(session.accountId, next)
            if (!isCurrentOptInSession(session)) return
            setPreference(next)
            setPermission('granted')
          },
          onPermissionState: (nextPermission) => {
            if (!isCurrentOptInSession(session)) return
            setPermission(nextPermission)
          },
          onFailure: (failed) => {
            if (!isCurrentOptInSession(session)) return
            setFailed(failed)
          },
        }),
        persistHandled: () => markOptInHandled(session),
        onHidden: () => {
          if (!isCurrentOptInSession(session)) return
          optInLoadedKey.current = `${session.accountId}:${session.installationId}`
          setOptInHandled(true)
          setOptInLoaded(true)
        },
      })
      if (outcome !== 'registered' && isCurrentOptInSession(session)) {
        // Failure/denied keeps the prompt mounted for retry. The flow already reported failure state.
      }
    } catch {
      if (isCurrentOptInSession(session)) setFailed(true)
    } finally {
      optInActionRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }, [captureOptInSession, currentInstallationId, isCurrentOptInSession, markOptInHandled, preference.pendingDisable, ready, registerDevice, serverState?.available])

  useEffect(() => {
    if (!accountId || !installationId || !preference.optedIn || optInHandled) return
    if (loadedAccount.current !== accountId) return
    if (liveAccountRef.current !== accountId || liveInstallationRef.current !== installationId) return
    optInLoadedKey.current = `${accountId}:${installationId}`
    setOptInHandled(true)
    setOptInLoaded(true)
    void markOptInHandled({ accountId, installationId, generation: sessionGeneration.current })
  }, [accountId, installationId, markOptInHandled, optInHandled, preference.optedIn])

  const openSettings = useCallback(async () => {
    await nativePushAdapter.openSettings().catch(() => setFailed(true))
  }, [])

  const refreshIfEligible = useCallback(() => {
    const liveAccount = liveAccountRef.current
    if (!liveAccount || !mountedRef.current || loadedAccount.current !== liveAccount || preference.pendingDisable) return
    if (!shouldSilentlyRefresh({
      optedIn: preference.optedIn,
      permissionGranted: permission === 'granted',
      accountMatches: true,
      memberReady: ready,
      backendAvailable: serverState?.available === true,
    })) return
    void registerCurrentDevice().catch(() => { if (mountedRef.current) setFailed(true) })
  }, [permission, preference.optedIn, preference.pendingDisable, ready, registerCurrentDevice, serverState?.available])

  const handleResponse = useCallback(async (response: { data: unknown; responseIdentifier?: string }) => {
    const payload = parsePushPayload(response.data)
    if (!payload) return
    if (!ready || auth.status !== 'signed_in' || loadedAccount.current !== auth.clerkUserId) {
      pendingResponse.current = response
      return
    }
    const key = responseEventKey({ notificationId: payload.notificationId, responseIdentifier: response.responseIdentifier })
    if (handledResponses.current.has(key)) return
    pendingResponse.current = response
    const result = await resolvePushTap({
      open: () => openNotification({ notificationId: payload.notificationId }),
      navigate: (destination) => router.push(mobileNotificationRoute(destination as MobileNotificationDestination) as never),
    })
    if (result.handled) {
      handledResponses.current.add(key)
      pendingResponse.current = null
    }
  }, [auth, openNotification, ready])

  const refreshPermissionOnForeground = useCallback(async () => {
    const liveAccount = liveAccountRef.current
    const liveGeneration = sessionGeneration.current
    if (!liveAccount || !mountedRef.current || loadedAccount.current !== liveAccount) return
    try {
      const currentPermission = await nativePushAdapter.getPermissionState()
      if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) return
      setPermission(currentPermission)
      if (preference.pendingDisable) {
        const acknowledged = await revoke(preference.optedIn)
        if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) return
        setFailed(!acknowledged)
      } else {
        const action = foregroundPermissionAction({
          optedIn: preference.optedIn,
          previousPermission: permission,
          currentPermission,
          memberReady: ready,
          backendAvailable: serverState?.available === true,
        })
        if (action === 'register') await registerCurrentDevice()
        else if (action === 'disable') {
          const acknowledged = await revoke(true)
          if (!mountedRef.current || sessionGeneration.current !== liveGeneration || liveAccountRef.current !== liveAccount) return
          setFailed(!acknowledged)
        }
      }
    } catch {
      if (mountedRef.current && sessionGeneration.current === liveGeneration && liveAccountRef.current === liveAccount) setFailed(true)
    }
    if (pendingResponse.current) await handleResponse(pendingResponse.current)
  }, [handleResponse, permission, preference.optedIn, preference.pendingDisable, ready, registerCurrentDevice, revoke, serverState?.available])

  useEffect(() => registerSignOutCleanup(cleanupForSignOut), [cleanupForSignOut])

  useEffect(() => {
    if (!accountId || !ready || !installationId || !preference.pendingDisable || launchRetryAccount.current === accountId) return
    launchRetryAccount.current = accountId
    void revoke(preference.optedIn)
      .then((acknowledged) => setFailed(!acknowledged))
      .catch(() => {
        setPreference({ optedIn: preference.optedIn, pendingDisable: true })
        setFailed(true)
      })
  }, [accountId, installationId, preference.optedIn, preference.pendingDisable, ready, revoke])

  useEffect(() => {
    refreshIfEligible()
    return nativePushAdapter.addForegroundListener(() => { void refreshPermissionOnForeground() })
  }, [refreshIfEligible, refreshPermissionOnForeground])

  useEffect(() => nativePushAdapter.addTokenListener(refreshIfEligible), [refreshIfEligible])

  useEffect(() => {
    if (!shouldApplyBadge(unreadCount) || typeof unreadCount !== 'number') return
    void nativePushAdapter.setBadgeCount(unreadCount).catch(() => {})
  }, [unreadCount])

  useEffect(() => {
    const remove = nativePushAdapter.addResponseListener((response) => { void handleResponse(response) })
    void nativePushAdapter.getLastResponse().then((response) => {
      if (response) void handleResponse(response)
    })
    return remove
  }, [handleResponse])

  useEffect(() => {
    if (!ready || !pendingResponse.current) return
    void handleResponse(pendingResponse.current)
  }, [handleResponse, ready])

  const state = useMemo<PushUiState>(() => resolvePushUiState({
    nativeAvailable: nativePushAdapter.available,
    memberReady: ready,
    accountMatches: bootstrap.accountId === accountId && loadedAccount.current === accountId,
    bootstrapStatus: bootstrap.status,
    backendTimedOut,
    serverState,
    busy,
    failed,
    permission,
    preference,
  }), [accountId, backendTimedOut, bootstrap.accountId, bootstrap.status, busy, failed, permission, preference, ready, serverState])

  const optInVisible = shouldShowPushOptInPrompt({
    nativeAvailable: nativePushAdapter.available,
    memberReady: ready,
    bootstrapStatus: bootstrap.status,
    accountMatches: bootstrap.accountId === accountId && loadedAccount.current === accountId,
    backendAvailable: serverState?.available === true,
    backendRegistered: serverState?.registered === true,
    optedIn: preference.optedIn,
    pendingDisable: preference.pendingDisable,
    permission,
    optInHandled,
    optInLoaded,
  })

  return (
    <PushContext.Provider
      value={{ state, enable, disable, openSettings, retryDisable, retryAvailability, cleanupForSignOut, optInVisible, acceptOptIn, dismissOptIn }}>
      {children}
      {optInVisible ? (
        <PushOptInPrompt visible={optInVisible} busy={busy} failed={failed} onEnable={() => { void acceptOptIn() }} onDismiss={() => { void dismissOptIn() }} />
      ) : null}
    </PushContext.Provider>
  )
}

export function usePushNotifications() {
  return useContext(PushContext)
}
