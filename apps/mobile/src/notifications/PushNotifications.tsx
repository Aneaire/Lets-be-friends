import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { registerSignOutCleanup, useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi } from '@/backend/client'
import { mobileNotificationRoute, type MobileNotificationDestination } from '@/data/notifications'
import { useMobileMember } from '@/member/MobileMember'

import { createPushRegistrationCoordinator, foregroundPermissionAction, parsePushPayload, resolvePushTap, resolvePushUiState, responseEventKey, revokePushRegistration, shouldApplyBadge, shouldRequestPermission, shouldRevokeOnSignOut, shouldSilentlyRefresh, type PushPreference, type PushUiState } from './logic'
import { nativePushAdapter } from './nativeAdapter'
import { readPushPreference, writePushPreference } from './preferences'

type PushContextValue = {
  state: PushUiState
  enable: () => Promise<void>
  disable: () => Promise<void>
  openSettings: () => Promise<void>
  retryDisable: () => Promise<void>
  retryAvailability: () => Promise<void>
  cleanupForSignOut: () => Promise<void>
}

const PushContext = createContext<PushContextValue>({
  state: { status: 'unavailable', message: 'Push notifications are unavailable.' },
  enable: async () => {},
  disable: async () => {},
  openSettings: async () => {},
  retryDisable: async () => {},
  retryAvailability: async () => {},
  cleanupForSignOut: async () => {},
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
  const bootstrapGeneration = useRef(0)
  const loadedAccount = useRef<string | null>(null)
  const launchRetryAccount = useRef<string | null>(null)
  const handledResponses = useRef(new Set<string>())
  const pendingResponse = useRef<{ data: unknown; responseIdentifier?: string } | null>(null)
  const registrationCoordinator = useMemo(createPushRegistrationCoordinator, [])

  const bootstrapAccount = useCallback(async (targetAccountId: string) => {
    const generation = ++bootstrapGeneration.current
    loadedAccount.current = null
    launchRetryAccount.current = null
    setPreference({ optedIn: false, pendingDisable: false })
    setPermission('unavailable')
    setInstallationId(null)
    setFailed(false)
    setBackendTimedOut(false)
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
    bootstrapGeneration.current += 1
    loadedAccount.current = null
    setBootstrap({ accountId, status: accountId ? 'loading' : 'idle' })
    if (accountId) void bootstrapAccount(accountId)
    else {
      launchRetryAccount.current = null
      setPreference({ optedIn: false, pendingDisable: false })
      setPermission('unavailable')
      setInstallationId(null)
      setFailed(false)
      setBackendTimedOut(false)
    }
    return () => { bootstrapGeneration.current += 1 }
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

  const currentInstallationId = useCallback(async () => {
    if (installationId) return installationId
    const installation = await nativePushAdapter.ensureInstallation()
    setInstallationId(installation.installationId)
    return installation.installationId
  }, [installationId])

  const registerCurrentDevice = useCallback(async () => {
    if (!accountId || !ready || !nativePushAdapter.available || serverState?.available !== true || preference.pendingDisable) return false
    return registrationCoordinator.register(
      accountId,
      async () => {
        const registration = await nativePushAdapter.getRegistration()
        if (!registration) return null
        const currentId = await currentInstallationId()
        return { installationId: currentId, ...registration }
      },
      async (candidate) => {
        await registerDevice(candidate)
        const next = { optedIn: true, pendingDisable: false }
        await writePushPreference(accountId, next)
        setPreference(next)
        setPermission('granted')
      },
    )
  }, [accountId, currentInstallationId, preference.pendingDisable, ready, registerDevice, registrationCoordinator, serverState?.available])

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

  const enable = useCallback(async () => {
    if (preference.pendingDisable || !shouldRequestPermission({ explicit: true, memberReady: ready, backendAvailable: serverState?.available === true })) return
    setBusy(true)
    setFailed(false)
    try {
      const current = await nativePushAdapter.getPermissionState()
      if (current === 'denied') {
        setPermission('denied')
        return
      }
      await nativePushAdapter.ensureNotificationChannel()
      const nextPermission = current === 'granted' ? current : await nativePushAdapter.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted' || !await registerCurrentDevice()) setFailed(nextPermission === 'granted')
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [preference.pendingDisable, ready, registerCurrentDevice, serverState?.available])

  const openSettings = useCallback(async () => {
    await nativePushAdapter.openSettings().catch(() => setFailed(true))
  }, [])

  const refreshIfEligible = useCallback(() => {
    if (!accountId || loadedAccount.current !== accountId || preference.pendingDisable) return
    if (!shouldSilentlyRefresh({
      optedIn: preference.optedIn,
      permissionGranted: permission === 'granted',
      accountMatches: true,
      memberReady: ready,
      backendAvailable: serverState?.available === true,
    })) return
    void registerCurrentDevice().catch(() => setFailed(true))
  }, [accountId, permission, preference.optedIn, preference.pendingDisable, ready, registerCurrentDevice, serverState?.available])

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
    if (!accountId || loadedAccount.current !== accountId) return
    try {
      const currentPermission = await nativePushAdapter.getPermissionState()
      setPermission(currentPermission)
      if (preference.pendingDisable) {
        const acknowledged = await revoke(preference.optedIn)
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
          setFailed(!acknowledged)
        }
      }
    } catch {
      setFailed(true)
    }
    if (pendingResponse.current) await handleResponse(pendingResponse.current)
  }, [accountId, handleResponse, permission, preference.optedIn, preference.pendingDisable, ready, registerCurrentDevice, revoke, serverState?.available])

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

  return <PushContext.Provider value={{ state, enable, disable, openSettings, retryDisable, retryAvailability, cleanupForSignOut }}>{children}</PushContext.Provider>
}

export function usePushNotifications() {
  return useContext(PushContext)
}
