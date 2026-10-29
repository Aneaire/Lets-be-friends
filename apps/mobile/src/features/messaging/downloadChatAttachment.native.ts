import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

import { chatDocumentMimeType } from '@/data/chatAttachments'

/**
 * Documents are downloaded only when the member asks for them. The file stays
 * in the app cache and the native save sheet lets the member keep a copy.
 */
export async function downloadChatAttachment(url: string, fileName: string) {
  const safeName = (fileName.replace(/[^A-Za-z0-9._ -]/g, '_').trim() || 'attachment').slice(0, 160)
  const target = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`
  const result = await FileSystem.downloadAsync(url, target)
  if (result.status !== 200) throw new Error('The file could not be downloaded.')
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Saving files is not available on this device.')
  }
  await Sharing.shareAsync(result.uri, {
    dialogTitle: 'Save attachment',
    mimeType: chatDocumentMimeType(fileName, result.mimeType),
  })
}
