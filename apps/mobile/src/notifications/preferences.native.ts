import * as SecureStore from 'expo-secure-store'

import { parsePushOptInPrompt, parsePushPreference, pushOptInPromptKey, pushPreferenceKey, serializePushOptInPrompt, serializePushPreference, type PushOptInPromptState, type PushPreference } from './logic'

export async function readPushPreference(clerkUserId: string) {
  return parsePushPreference(await SecureStore.getItemAsync(pushPreferenceKey(clerkUserId)))
}

export async function writePushPreference(clerkUserId: string, value: PushPreference) {
  await SecureStore.setItemAsync(pushPreferenceKey(clerkUserId), serializePushPreference(value))
}

export async function readPushOptInPrompt(clerkUserId: string, installationId: string) {
  if (!installationId) return { handled: false }
  return parsePushOptInPrompt(await SecureStore.getItemAsync(pushOptInPromptKey(clerkUserId, installationId)))
}

export async function writePushOptInPrompt(clerkUserId: string, installationId: string, value: PushOptInPromptState) {
  if (!installationId) return
  await SecureStore.setItemAsync(pushOptInPromptKey(clerkUserId, installationId), serializePushOptInPrompt(value))
}
