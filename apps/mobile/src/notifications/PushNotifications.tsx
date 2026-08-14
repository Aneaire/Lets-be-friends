import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { registerSignOutCleanup, useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi } from '@/backend/client'
import { mobileNotificationRoute, type MobileNotificationDestination } from '@/data/notifications'
import { useMobileMember } from '@/member/MobileMember'

import { foregroundPermissionAction, parsePushPayload, resolvePushTap, responseEventKey, revokePushRegistration, shouldApplyBadge, shouldRequestPermission, shouldRevokeOnSignOut, shouldSilentlyRefresh, type PushPreference } from './logic'
import { nativePushAdapter } from './nativeAdapter'
import { readPushPreference, writePushPreference } from './preferences'

type PushUiState =
  | { status: 'unavailable'; message: string }
  | { status: 'loading'; message: string }
  | { status: 'pending_disable'; message: string }
  | { status: 'disabled'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'enabled'; message: string }
  | { status: 'error'; message: string }

type PushContextValue = {
  state: PushUiState
  enable: () => Promise<void>
  disable: () => Promise<void>
  openSettings: () => Promise<void>
  retryDisable: () => Promise<void>
  cleanupForSignOut: () => Promise<void>
}

const PushContext = createContext<PushContextValue>({
  state: { status: 'unavailable', message: 'Push notifications are unavailable.' },
  enable: async () => {},
  disable: async () => {},
  openSettings: async () => {},
  retryDisable: async () => {},
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
  const loadedAccount = useRef<string | null>(null)
  const launchRetryAccount = useRef<string | null>(null)
  const handledResponses = useRef(new Set<string>())
  const pendingResponse = useRef<{ data: unknown; responseIdentifier?: string } | null>(null)

  useEffect(() => {
    loadedAccount.current = null
    launchRetryAccount.current = null
    setPreference({ optedIn: false, pendingDisable: false })
    setPermission('unavailable')
    setInstallationId(null)
    setFailed(false)
    if (!accountId) return
    let cancelled = false
    void Promise.all([
      readPushPreference(accountId),
      nativePushAdapter.getPermissionState(),
      nativePushAdapter.available ? nativePushAdapter.ensureInstallation() : Promise.resolve(null),
    ]).then(async ([saved, currentPermission, installation]) => {
      if (cancelled) return
      const currentPreference = installation?.freshInstall
        ? { optedIn: false, pendingDisable: false }
        : saved
      if (installation?.freshInstall) {
        await nativePushAdapter.unregister().catch(() => {})
        await writePushPreference(accountId, currentPreference)
      }
      if (cancelled) return
      loadedAccount.current = accountId
      setPreference(currentPreference)
      setPermission(currentPermission)
      setInstallationId(installation?.installationId ?? null)
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => { cancelled = true }
  }, [accountId])

  const currentInstallationId = useCallback(async () => {
    if (installationId) return installationId
    const installation = await nativePushAdapter.ensureInstallation()
    setInstallationId(installation.installationId)
    return installation.installationId
  }, [installationId])

  const registerCurrentDevice = useCallback(async () => {
    if (!accountId || !ready || !nativePushAdapter.available || serverState?.available !== true || preference.pendingDisable) return false
    const registration = await nativePushAdapter.getRegistration()
    if (!registration) return false
    const currentId = await currentInstallationId()
    await registerDevice({ installationId: currentId, ...registration })
    const next = { optedIn: true, pendingDisable: false }
    await writePushPreference(accountId, next)
    setPreference(next)
    setPermission('granted')
    return true
  }, [accountId, currentInstallationId, preference.pendingDisable, ready, registerDevice, serverState?.available])

  const revoke = useCallback(async (nextOptedIn: boolean) => {
    if (!accountId) {
      await nativePushAdapter.unregister().catch(() => {})
      return false
    }
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
  }, [accountId, currentInstallationId, disableDevice, ready])

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

  const state = useMemo<PushUiState>(() => {
    if (!nativePushAdapter.available) return { status: 'unavailable', message: 'Push notifications require a physical iOS or Android development build.' }
    if (!ready) return { status: 'unavailable', message: 'Push notifications are available after your signed-in member profile is ready.' }
    if (serverState === undefined || loadedAccount.current !== accountId) return { status: 'loading', message: 'Checking notification availability.' }
    if (busy) return { status: 'loading', message: preference.pendingDisable ? 'Turning off push notifications.' : preference.optedIn ? 'Updating push notifications.' : 'Enabling push notifications.' }
    if (preference.pendingDisable) return { status: 'pending_disable', message: 'Push was turned off on this device, but server cleanup still needs to finish.' }
    if (permission === 'denied') return { status: 'denied', message: 'Notifications are blocked. Open device settings to allow them.' }
    if (preference.optedIn && serverState.registered) {
      return serverState.available
        ? { status: 'enabled', message: 'Generic account updates may appear on this device.' }
        : { status: 'enabled', message: 'Push delivery is unavailable, but this device is still registered. You can turn it off.' }
    }
    if (!serverState.available) return { status: 'unavailable', message: 'Push notifications are not available in this build.' }
    if (failed) return { status: 'error', message: 'Push notification settings could not be updated. Please try again.' }
    return { status: 'disabled', message: 'Push notifications are off for this account on this device.' }
  }, [accountId, busy, failed, permission, preference.optedIn, preference.pendingDisable, ready, serverState])

  return <PushContext.Provider value={{ state, enable, disable, openSettings, retryDisable, cleanupForSignOut }}>{children}</PushContext.Provider>
}

export function usePushNotifications() {
  return useContext(PushContext)
}
