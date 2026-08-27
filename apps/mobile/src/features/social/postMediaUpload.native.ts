import * as FileSystem from 'expo-file-system/legacy'

import { uploadedStorageId } from './postMediaUploadResult'
import type { PostMediaSource, PreparedPostMedia } from './postMediaUpload'

export async function preparePostMedia(source: PostMediaSource): Promise<PreparedPostMedia> {
  const info = await FileSystem.getInfoAsync(source.uri)
  if (!info.exists || info.isDirectory) throw new Error('The selected media could not be read.')
  return { uri: source.uri, mimeType: source.mimeType || '', fileSize: info.size }
}

export async function uploadPostMedia(uploadUrl: string, media: PreparedPostMedia) {
  const response = await FileSystem.uploadAsync(uploadUrl, media.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': media.mimeType },
  })
  const storageId = uploadedStorageId(response.status, response.body)
  if (!storageId) throw new Error('A media upload failed. No media was attached to your post.')
  return storageId
}
