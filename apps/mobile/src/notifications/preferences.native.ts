import * as SecureStore from 'expo-secure-store'

import { parsePushPreference, pushPreferenceKey, serializePushPreference, type PushPreference } from './logic'

export async function readPushPreference(clerkUserId: string) {
  return parsePushPreference(await SecureStore.getItemAsync(pushPreferenceKey(clerkUserId)))
}

export async function writePushPreference(clerkUserId: string, value: PushPreference) {
  await SecureStore.setItemAsync(pushPreferenceKey(clerkUserId), serializePushPreference(value))
}
