import type { CSSProperties, Dispatch, SetStateAction } from 'react'

/**
 * Facebook-style feed media keeps the natural aspect ratio between a tall 4:5
 * crop and a wide 1.91:1 crop. Everything in between stays fluid, so a square
 * photo stays square, a portrait keeps most of its height, and an extreme
 * panorama is bounded instead of collapsing into a thin strip.
 */
export const MIN_FLUID_MEDIA_ASPECT = 4 / 5
export const MAX_FLUID_MEDIA_ASPECT = 1.91

export function clampMediaAspect(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined
  return Math.min(MAX_FLUID_MEDIA_ASPECT, Math.max(MIN_FLUID_MEDIA_ASPECT, width / height))
}

export function rememberMediaAspect(
  setAspects: Dispatch<SetStateAction<Record<string, number>>>,
  key: string,
  width: number,
  height: number,
) {
  const aspect = clampMediaAspect(width, height)
  if (aspect === undefined) return
  setAspects((current) => current[key] === aspect ? current : { ...current, [key]: aspect })
}

export function mediaAspectStyle(aspect: number | undefined, property: string): CSSProperties | undefined {
  return aspect === undefined ? undefined : { [property]: aspect } as CSSProperties
}
