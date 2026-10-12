export async function requestMediaLibraryPermissionsAsync() {
  return { granted: false as const, status: 'denied' as const, canAskAgain: false as const, expires: 'never' as const }
}

export async function launchImageLibraryAsync() {
  return { canceled: true as const, assets: null }
}
