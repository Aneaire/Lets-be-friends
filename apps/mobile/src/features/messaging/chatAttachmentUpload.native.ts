import * as FileSystem from 'expo-file-system/legacy'

import { uploadedStorageId } from '@/features/social/postMediaUploadResult'

import type { ChatAttachmentSource, PreparedChatUpload } from './chatAttachmentUpload'

export type { ChatAttachmentSource, PreparedChatUpload }

export async function prepareChatUpload(source: ChatAttachmentSource): Promise<PreparedChatUpload> {
  const info = await FileSystem.getInfoAsync(source.uri)
  if (!info.exists || info.isDirectory) throw new Error('The selected file could not be read. Please choose it again.')
  const size = info.size ?? 0
  const response = await fetch(source.uri)
  if (!response.ok) throw new Error('The selected file could not be read. Please choose it again.')
  const body = await response.blob()
  return {
    uri: source.uri,
    mimeType: source.mimeType || body.type,
    fileSize: size || body.size,
    body,
  }
}

export async function uploadChatAttachment(uploadUrl: string, upload: PreparedChatUpload) {
  const response = await FileSystem.uploadAsync(uploadUrl, upload.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': upload.mimeType },
  })
  const storageId = uploadedStorageId(response.status, response.body)
  if (!storageId) throw new Error('A file upload failed. No file was attached to your message.')
  return storageId
}
