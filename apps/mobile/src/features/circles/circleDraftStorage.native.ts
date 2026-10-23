import * as SecureStore from 'expo-secure-store'

import type { CircleDraftStorage } from './circleCreationDraft'

export function createNativeCircleDraftStorage(secureStore: Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>): CircleDraftStorage {
  return {
    async read(key: string) {
      return secureStore.getItemAsync(key)
    },
    async write(key: string, value: string) {
      await secureStore.setItemAsync(key, value)
    },
    async remove(key: string) {
      await secureStore.deleteItemAsync(key)
    },
  }
}

export function getCircleDraftStorage(): CircleDraftStorage {
  return createNativeCircleDraftStorage(SecureStore)
}
