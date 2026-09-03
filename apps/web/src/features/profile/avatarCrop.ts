export type AvatarCrop = {
  x: number
  y: number
  zoom: number
}

export const defaultAvatarCrop: AvatarCrop = { x: 0, y: 0, zoom: 1 }

export function avatarCropSource(
  imageWidth: number,
  imageHeight: number,
  crop: AvatarCrop,
) {
  const zoom = clamp(crop.zoom, 1, 3)
  const size = Math.min(imageWidth, imageHeight) / zoom
  const maxX = (imageWidth - size) / 2
  const maxY = (imageHeight - size) / 2

  return {
    x: imageWidth / 2 - size / 2 - clamp(crop.x, -1, 1) * maxX,
    y: imageHeight / 2 - size / 2 - clamp(crop.y, -1, 1) * maxY,
    size,
  }
}

export async function createCroppedAvatarFile(
  file: File,
  crop: AvatarCrop,
  outputSize = 768,
) {
  if (!file.type.startsWith('image/')) throw new Error('Profile image must be an image file.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile image must be 5 MB or smaller.')

  const image = await loadImage(file)
  const source = avatarCropSource(image.naturalWidth, image.naturalHeight, crop)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize

  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not prepare the profile image.')
  context.drawImage(
    image,
    source.x,
    source.y,
    source.size,
    source.size,
    0,
    0,
    outputSize,
    outputSize,
  )

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('This browser could not prepare the profile image.')

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile-photo'
  return new File([blob], `${baseName}-avatar.webp`, { type: blob.type || 'image/webp' })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('The selected profile image could not be opened.'))
    }
    image.src = objectUrl
  })
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
