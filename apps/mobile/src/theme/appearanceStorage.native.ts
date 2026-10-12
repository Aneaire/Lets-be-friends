import * as SecureStore from 'expo-secure-store'

import { appearanceStorageKey, type AppearanceStorage } from './appearance'

export function getAppearanceStorage(): AppearanceStorage {
  return {
    async read() {
      return SecureStore.getItemAsync(appearanceStorageKey)
    },
    async write(value: string) {
      await SecureStore.setItemAsync(appearanceStorageKey, value)
    },
  }
}
