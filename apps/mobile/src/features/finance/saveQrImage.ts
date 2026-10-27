import { File, Paths } from 'expo-file-system'
import { Asset, requestPermissionsAsync } from 'expo-media-library'
import { Platform } from 'react-native'

import { qrImageFileName } from '@/data/wallet'

export type SaveQrImageResult =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'unsupported' }

/**
 * Saves the PayMongo QR Ph image to the device photo library so a member can
 * pay from another phone. The web fallback uses a normal file download.
 */
export async function saveQrImageToPhotos(imageUrl: string, topUpId: string): Promise<SaveQrImageResult> {
  const fileName = qrImageFileName(topUpId)

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return { ok: false, reason: 'unsupported' }
    const anchor = document.createElement('a')
    anchor.href = imageUrl
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return { ok: true }
  }

  const permission = await requestPermissionsAsync(true, ['photo'])
  if (!permission.granted) return { ok: false, reason: 'permission' }

  const destination = new File(Paths.cache, fileName)
  let file = destination
  try {
    const inline = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(imageUrl)
    if (inline) {
      destination.create({ overwrite: true })
      destination.write(inline[1].replace(/\s/g, ''), { encoding: 'base64' })
    } else if (/^https:\/\//i.test(imageUrl)) {
      file = await File.downloadFileAsync(imageUrl, destination, { idempotent: true })
    } else {
      return { ok: false, reason: 'unsupported' }
    }
    await Asset.create(file.uri)
  } finally {
    try {
      if (file.exists) file.delete()
    } catch {
      // Cache cleanup is best effort; the saved asset is already in the library.
    }
  }
  return { ok: true }
}
