export type AvatarCrop = {
  x: number
  y: number
  zoom: number
}

export const defaultAvatarCrop: AvatarCrop = { x: 0, y: 0, zoom: 1 }

export const AVATAR_ZOOM_MIN = 1
export const AVATAR_ZOOM_MAX = 3
export const AVATAR_ZOOM_STEP = 0.05
export const AVATAR_OUTPUT_SIZE = 768

export const AVATAR_CROP_POSITION_RANGE = 1

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function clampAvatarZoom(zoom: number) {
  return clamp(zoom, AVATAR_ZOOM_MIN, AVATAR_ZOOM_MAX)
}

export function stepAvatarZoom(zoom: number, direction: 1 | -1) {
  const stepped = Math.round((zoom + direction * AVATAR_ZOOM_STEP) / AVATAR_ZOOM_STEP) * AVATAR_ZOOM_STEP
  return clampAvatarZoom(Number(stepped.toFixed(2)))
}

export function normalizeAvatarCrop(crop: AvatarCrop): AvatarCrop {
  return {
    x: clamp(crop.x, -AVATAR_CROP_POSITION_RANGE, AVATAR_CROP_POSITION_RANGE),
    y: clamp(crop.y, -AVATAR_CROP_POSITION_RANGE, AVATAR_CROP_POSITION_RANGE),
    zoom: clampAvatarZoom(crop.zoom),
  }
}

export type AvatarCropSource = {
  x: number
  y: number
  size: number
}

export function avatarCropSource(imageWidth: number, imageHeight: number, crop: AvatarCrop): AvatarCropSource {
  const zoom = clampAvatarZoom(crop.zoom)
  const size = Math.min(imageWidth, imageHeight) / zoom
  const maxX = (imageWidth - size) / 2
  const maxY = (imageHeight - size) / 2

  return {
    x: imageWidth / 2 - size / 2 - clamp(crop.x, -1, 1) * maxX,
    y: imageHeight / 2 - size / 2 - clamp(crop.y, -1, 1) * maxY,
    size,
  }
}

export type AvatarPreviewGeometry = {
  width: number
  height: number
  offsetX: number
  offsetY: number
  maxOffsetX: number
  maxOffsetY: number
}

export function avatarPreviewGeometry(
  imageWidth: number,
  imageHeight: number,
  crop: AvatarCrop,
  previewSize: number,
): AvatarPreviewGeometry {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: previewSize, height: previewSize, offsetX: 0, offsetY: 0, maxOffsetX: 0, maxOffsetY: 0 }
  }

  const scale = Math.max(previewSize / imageWidth, previewSize / imageHeight) * clampAvatarZoom(crop.zoom)
  const width = imageWidth * scale
  const height = imageHeight * scale
  const maxOffsetX = Math.max(0, (width - previewSize) / 2)
  const maxOffsetY = Math.max(0, (height - previewSize) / 2)

  return {
    width,
    height,
    maxOffsetX,
    maxOffsetY,
    offsetX: clamp(crop.x, -1, 1) * maxOffsetX,
    offsetY: clamp(crop.y, -1, 1) * maxOffsetY,
  }
}

export function avatarCropPositionFromDrag(
  crop: AvatarCrop,
  geometry: AvatarPreviewGeometry,
  deltaX: number,
  deltaY: number,
): AvatarCrop {
  const x = geometry.maxOffsetX > 0
    ? crop.x + deltaX / geometry.maxOffsetX
    : 0
  const y = geometry.maxOffsetY > 0
    ? crop.y + deltaY / geometry.maxOffsetY
    : 0
  return { ...crop, x: clamp(x, -1, 1), y: clamp(y, -1, 1) }
}

export function avatarCropIsDefault(crop: AvatarCrop) {
  return crop.x === defaultAvatarCrop.x
    && crop.y === defaultAvatarCrop.y
    && crop.zoom === defaultAvatarCrop.zoom
}
