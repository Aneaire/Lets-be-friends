export function uploadedStorageId(status: number, body: string) {
  if (status < 200 || status >= 300) return undefined

  try {
    const result = JSON.parse(body) as { storageId?: unknown }
    return typeof result.storageId === 'string' && result.storageId ? result.storageId : undefined
  } catch {
    return undefined
  }
}
