import { avatarCropSource, AVATAR_OUTPUT_SIZE, type AvatarCrop } from './avatarCrop'

export type CroppedProfileImage = {
  blob: Blob
  mimeType: string
}

export async function cropProfileImage(uri: string, crop: AvatarCrop): Promise<CroppedProfileImage> {
  const image = await loadImage(uri)
  const source = avatarCropSource(image.naturalWidth, image.naturalHeight, crop)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_OUTPUT_SIZE
  canvas.height = AVATAR_OUTPUT_SIZE

  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not prepare the profile image.')
  context.drawImage(image, source.x, source.y, source.size, source.size, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('This browser could not prepare the profile image.')
  return { blob, mimeType: blob.type || 'image/webp' }
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The selected profile image could not be opened.'))
    image.src = uri
  })
}
