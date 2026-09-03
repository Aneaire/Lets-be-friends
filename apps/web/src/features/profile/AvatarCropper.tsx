import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clamp, defaultAvatarCrop, type AvatarCrop } from './avatarCrop'

const previewSize = 240

export function AvatarCropper({
  crop,
  file,
  onChange,
}: {
  crop: AvatarCrop
  file: File
  onChange: (crop: AvatarCrop) => void
}) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    crop: AvatarCrop
  } | null>(null)
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file])

  useEffect(() => {
    setImageSize({ width: 0, height: 0 })
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const geometry = previewGeometry(imageSize.width, imageSize.height, crop)

  function updatePosition(x: number, y: number) {
    onChange({ ...crop, x: clamp(x, -1, 1), y: clamp(y, -1, 1) })
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const currentDrag = drag.current
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return
    const x = geometry.maxOffsetX > 0
      ? currentDrag.crop.x + (event.clientX - currentDrag.startX) / geometry.maxOffsetX
      : 0
    const y = geometry.maxOffsetY > 0
      ? currentDrag.crop.y + (event.clientY - currentDrag.startY) / geometry.maxOffsetY
      : 0
    updatePosition(x, y)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.025
    const next = {
      ArrowLeft: { x: crop.x - step, y: crop.y },
      ArrowRight: { x: crop.x + step, y: crop.y },
      ArrowUp: { x: crop.x, y: crop.y - step },
      ArrowDown: { x: crop.x, y: crop.y + step },
    }[event.key]
    if (!next) return
    event.preventDefault()
    updatePosition(next.x, next.y)
  }

  return (
    <section className="avatar-cropper" aria-labelledby="avatar-cropper-title">
      <div className="avatar-cropper-heading">
        <div>
          <strong id="avatar-cropper-title">Choose your profile view</strong>
          <span>Drag the photo to position it inside the circle.</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm avatar-cropper-reset"
          onClick={() => onChange(defaultAvatarCrop)}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Reset
        </button>
      </div>

      <div
        className="avatar-cropper-frame"
        role="group"
        tabIndex={0}
        aria-label="Avatar preview. Drag or use the arrow keys to position the photo."
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
      >
        <img
          src={previewUrl}
          alt=""
          draggable={false}
          onLoad={(event) => setImageSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })}
          style={{
            width: geometry.width,
            height: geometry.height,
            transform: `translate(calc(-50% + ${geometry.offsetX}px), calc(-50% + ${geometry.offsetY}px))`,
          }}
        />
        <span className="avatar-cropper-ring" aria-hidden="true" />
      </div>

      <label className="avatar-cropper-zoom">
        <span>Zoom</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={crop.zoom}
          onChange={(event) => onChange({ ...crop, zoom: Number(event.currentTarget.value) })}
          aria-label="Zoom profile photo"
        />
        <output>{crop.zoom.toFixed(1)}×</output>
      </label>
    </section>
  )
}

export function previewGeometry(
  imageWidth: number,
  imageHeight: number,
  crop: AvatarCrop,
) {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: previewSize, height: previewSize, offsetX: 0, offsetY: 0, maxOffsetX: 0, maxOffsetY: 0 }
  }

  const scale = Math.max(previewSize / imageWidth, previewSize / imageHeight) * clamp(crop.zoom, 1, 3)
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
