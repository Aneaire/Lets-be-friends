import { shouldRequestMediaLibraryPermission } from '@/media/mediaLibraryPermission'

describe('media library permission gate', () => {
  it('never asks the web build', () => {
    expect(shouldRequestMediaLibraryPermission('web', 33)).toBe(false)
  })

  it('asks on iOS, which still needs photo library access', () => {
    expect(shouldRequestMediaLibraryPermission('ios', 18)).toBe(true)
  })

  it('does not ask on Android 13 and newer, where the system photo picker runs without broad access', () => {
    expect(shouldRequestMediaLibraryPermission('android', 33)).toBe(false)
    expect(shouldRequestMediaLibraryPermission('android', 34)).toBe(false)
    expect(shouldRequestMediaLibraryPermission('android', '35')).toBe(false)
  })

  it('still asks on Android 12 and older, which need legacy storage access', () => {
    expect(shouldRequestMediaLibraryPermission('android', 32)).toBe(true)
    expect(shouldRequestMediaLibraryPermission('android', 30)).toBe(true)
    expect(shouldRequestMediaLibraryPermission('android', '29')).toBe(true)
  })

  it('treats an unknown Android version as legacy so the picker keeps working', () => {
    expect(shouldRequestMediaLibraryPermission('android', Number.NaN)).toBe(true)
    expect(shouldRequestMediaLibraryPermission('android', 'unknown')).toBe(true)
  })
})
