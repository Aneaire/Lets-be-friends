import Constants from 'expo-constants'
import * as Crypto from 'expo-crypto'
import * as Device from 'expo-device'
import { Directory, File, Paths } from 'expo-file-system'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { AppState, Linking, Platform } from 'react-native'

import { ANDROID_NOTIFICATION_CHANNEL_ID, androidNotificationChannelSettings, installationBoundary, pushInstallationKey, pushInstallMarkerKey } from './logic'
import type { NativePermissionState, NativePushAdapter, NativePushResponse } from './nativeAdapter'

const INSTALLATION_KEY = pushInstallationKey()
const INSTALL_MARKER_KEY = pushInstallMarkerKey()
const INSTALL_MARKER_FILE = 'push-install-marker'
let installationPromise: Promise<{ installationId: string; freshInstall: boolean }> | null = null

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export const nativePushAdapter: NativePushAdapter = {
  available: Device.isDevice && (Platform.OS === 'ios' || Platform.OS === 'android'),
  ensureInstallation: async () => {
    if (!installationPromise) {
      installationPromise = ensureInstallation().catch((error) => {
        installationPromise = null
        throw error
      })
    }
    return await installationPromise
  },
  ensureNotificationChannel: async () => {
    if (Platform.OS === 'android') await ensureAndroidChannel()
  },
  getPermissionState: async () => permissionState(await Notifications.getPermissionsAsync()),
  requestPermission: async () => permissionState(await Notifications.requestPermissionsAsync()),
  getRegistration: async () => {
    if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return null
    if (Platform.OS === 'android') await ensureAndroidChannel()
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId
    if (typeof projectId !== 'string' || !projectId.trim()) return null
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    if (!token.data) return null
    return { expoPushToken: token.data, projectId, platform: Platform.OS }
  },
  unregister: async () => {
    await Notifications.unregisterForNotificationsAsync()
  },
  openSettings: async () => {
    await Linking.openSettings()
  },
  setBadgeCount: async (count) => {
    await Notifications.setBadgeCountAsync(count)
  },
  getLastResponse: async () => {
    const response = await Notifications.getLastNotificationResponseAsync()
    return response ? nativeResponse(response) : null
  },
  addResponseListener: (listener) => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => listener(nativeResponse(response)))
    return () => subscription.remove()
  },
  addTokenListener: (listener) => {
    const subscription = Notifications.addPushTokenListener(() => listener())
    return () => subscription.remove()
  },
  addForegroundListener: (listener) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') listener()
    })
    return () => subscription.remove()
  },
}

async function ensureInstallation() {
  const markerDirectory = new Directory(Paths.cache, '.installation')
  const markerFile = new File(markerDirectory, INSTALL_MARKER_FILE)
  const [secureMarker, storedInstallationId] = await Promise.all([
    SecureStore.getItemAsync(INSTALL_MARKER_KEY),
    SecureStore.getItemAsync(INSTALLATION_KEY),
  ])
  const fileMarker = markerFile.exists ? await markerFile.text() : null
  const boundary = installationBoundary({ secureMarker, fileMarker, storedInstallationId })
  if (!boundary.freshInstall) return boundary
  const marker = Crypto.randomUUID()
  const installationId = Crypto.randomUUID()
  if (!markerDirectory.exists) markerDirectory.create({ intermediates: true, idempotent: true })
  markerFile.write(marker)
  await Promise.all([
    SecureStore.setItemAsync(INSTALL_MARKER_KEY, marker),
    SecureStore.setItemAsync(INSTALLATION_KEY, installationId),
  ])
  return { installationId, freshInstall: true }
}

async function ensureAndroidChannel() {
  await Notifications.setNotificationChannelAsync(
    ANDROID_NOTIFICATION_CHANNEL_ID,
    androidNotificationChannelSettings({
      highImportance: Notifications.AndroidImportance.HIGH,
      secretVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    }),
  )
}

function permissionState(permission: Notifications.NotificationPermissionsStatus): NativePermissionState {
  if (permission.granted) return 'granted'
  if (permission.status === Notifications.PermissionStatus.DENIED) return 'denied'
  return 'undetermined'
}

function nativeResponse(response: Notifications.NotificationResponse): NativePushResponse {
  return {
    data: response.notification.request.content.data,
    responseIdentifier: response.notification.request.identifier,
  }
}
