import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

// Android 13 (API 33) introduced the system photo picker. From 33 onward the
// picker returns the member's selection without broad library access, so the app
// no longer declares READ_MEDIA_IMAGES or READ_MEDIA_VIDEO. Older versions still
// need the legacy storage permission, and iOS still needs photo library access.
const ANDROID_SYSTEM_PHOTO_PICKER_API = 33

export function shouldRequestMediaLibraryPermission(
  platformOS: string,
  version: number | string,
): boolean {
  if (platformOS === 'web') return false
  if (platformOS !== 'android') return true
  const api = typeof version === 'number' ? version : Number.parseInt(String(version), 10)
  // An unknown version is treated as legacy so the picker still works there.
  return !Number.isFinite(api) || api < ANDROID_SYSTEM_PHOTO_PICKER_API
}

export async function mediaLibraryPermission(): Promise<{ granted: boolean }> {
  if (Platform.OS === 'web') return { granted: true }
  if (!shouldRequestMediaLibraryPermission(Platform.OS, Platform.Version)) return { granted: true }
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
  return { granted: permission.granted }
}
